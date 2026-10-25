import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  createPrivateDownloadUrl,
  isCloudinaryConfigured,
  uploadPrivateFile
} from '../services/cloudinary.js';

const router = express.Router();
const maxResumeBytes = 5 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxResumeBytes, files: 1 },
  fileFilter: (req, file, callback) => {
    const isPdf = file.mimetype === 'application/pdf' && /\.pdf$/i.test(file.originalname);
    const isImage = ['image/jpeg', 'image/png'].includes(file.mimetype) &&
      /\.(jpe?g|png)$/i.test(file.originalname);
    if (!isPdf && !isImage) {
      callback(new Error('Only PDF resumes or JPEG/PNG profile images are accepted.'));
      return;
    }
    callback(null, true);
  }
});

const profileInput = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  branch: z.string().trim().max(100).nullable().optional(),
  graduationYear: z.number().int().min(1980).max(2200).nullable().optional(),
  cgpa: z.number().min(0).max(10).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  skills: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  portfolioLinks: z.record(z.string().url()).nullable().optional()
});

function uploadSingleFile(req, res, next) {
  upload.single('file')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, message: 'The file exceeds the 5 MB size limit.' });
    }
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: 'Upload one file at a time.' });
    }
    return res.status(400).json({ success: false, message: error.message || 'Invalid file upload.' });
  });
}

function hasPdfSignature(buffer) {
  return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
}

function hasImageSignature(buffer, mimeType) {
  if (mimeType === 'image/png') {
    return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (mimeType === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  return false;
}

async function recruiterCanViewStudent(req, studentId) {
  if (req.user.role === 'PLACEMENT_OFFICER') return true;
  if (req.user.role !== 'RECRUITER' || !req.user.isApproved || !req.user.recruiterProfile?.companyId) {
    return false;
  }
  const application = await prisma.application.findFirst({
    where: {
      studentId,
      job: { companyId: req.user.recruiterProfile.companyId }
    },
    select: { id: true }
  });
  return Boolean(application);
}

function getStudentSummary(profile, includeContact) {
  return {
    id: profile.id,
    fullName: profile.fullName,
    branch: profile.branch,
    graduationYear: profile.graduationYear,
    cgpa: profile.cgpa,
    phone: includeContact ? profile.phone : undefined,
    skills: profile.skills,
    portfolioLinks: profile.portfolioLinks,
    hasResume: Boolean(profile.resumeUrl),
    hasProfileImage: Boolean(profile.profileImageUrl)
  };
}

/**
 * @openapi
 * /students/me:
 *   get:
 *     summary: Get the signed-in student's profile
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current student profile without private resume metadata.
 *   patch:
 *     summary: Update the signed-in student's profile
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName: { type: string }
 *               branch: { type: string }
 *               graduationYear: { type: integer }
 *               cgpa: { type: number, minimum: 0, maximum: 10 }
 *               phone: { type: string }
 *               skills:
 *                 type: array
 *                 items: { type: string }
 *               portfolioLinks:
 *                 type: object
 *     responses:
 *       200:
 *         description: Updated profile.
 *       400:
 *         description: Invalid profile fields.
 */
router.get('/students/me', requireAuth, requireRole('STUDENT'), async (req, res, next) => {
  try {
    if (!req.user.studentProfile) {
      return res.status(404).json({ success: false, message: 'Student profile was not found.' });
    }
    return res.json({
      success: true,
      data: {
        ...getStudentSummary(req.user.studentProfile, true),
        email: req.user.email
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.patch('/students/me', requireAuth, requireRole('STUDENT'), async (req, res, next) => {
  try {
    const parsed = profileInput.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'Invalid student profile.', issues: parsed.error.issues });
    }
    if (!req.user.studentProfile) {
      return res.status(404).json({ success: false, message: 'Student profile was not found.' });
    }
    const profile = await prisma.studentProfile.update({
      where: { id: req.user.studentProfile.id },
      data: parsed.data
    });
    return res.json({ success: true, data: getStudentSummary(profile, true) });
  } catch (error) {
    return next(error);
  }
});

/**
 * @openapi
 * /students/me/resume:
 *   post:
 *     summary: Upload or replace a private PDF resume
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Resume uploaded.
 *       400:
 *         description: Invalid PDF file.
 *       413:
 *         description: File exceeds 5 MB.
 *       503:
 *         description: Cloudinary is not configured.
 */
router.post('/students/me/resume', requireAuth, requireRole('STUDENT'), uploadSingleFile, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Choose a PDF resume to upload.' });
    if (req.file.mimetype !== 'application/pdf' || !hasPdfSignature(req.file.buffer)) {
      return res.status(400).json({ success: false, message: 'The uploaded file is not a valid PDF document.' });
    }
    if (!req.user.studentProfile) {
      return res.status(404).json({ success: false, message: 'Student profile was not found.' });
    }
    if (!isCloudinaryConfigured()) {
      return res.status(503).json({ success: false, message: 'Resume storage is not configured. Set Cloudinary credentials on the server.' });
    }

    const publicId = `student-${req.user.studentProfile.id}-resume`;
    const uploaded = await uploadPrivateFile(req.file.buffer, {
      folder: 'campusconnect/resumes',
      publicId,
      resourceType: 'raw',
      format: 'pdf'
    });

    const profile = await prisma.studentProfile.update({
      where: { id: req.user.studentProfile.id },
      data: { resumeUrl: uploaded.public_id }
    });

    return res.json({
      success: true,
      message: 'Resume uploaded successfully.',
      data: { hasResume: Boolean(profile.resumeUrl) }
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * @openapi
 * /students/me/profile-image:
 *   post:
 *     summary: Upload a private student profile image
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile image uploaded.
 *   get:
 *     summary: Get a short-lived profile image URL
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Private image URL.
 */
router.post('/students/me/profile-image', requireAuth, requireRole('STUDENT'), uploadSingleFile, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Choose a JPEG or PNG profile image.' });
    if (!hasImageSignature(req.file.buffer, req.file.mimetype)) {
      return res.status(400).json({ success: false, message: 'The uploaded file is not a valid JPEG or PNG image.' });
    }
    if (!req.user.studentProfile) {
      return res.status(404).json({ success: false, message: 'Student profile was not found.' });
    }
    if (!isCloudinaryConfigured()) {
      return res.status(503).json({ success: false, message: 'Image storage is not configured. Set Cloudinary credentials on the server.' });
    }

    const uploaded = await uploadPrivateFile(req.file.buffer, {
      folder: 'campusconnect/profile-images',
      publicId: `student-${req.user.studentProfile.id}-profile`,
      resourceType: 'image',
      format: 'jpg'
    });
    const profile = await prisma.studentProfile.update({
      where: { id: req.user.studentProfile.id },
      data: { profileImageUrl: uploaded.public_id }
    });

    return res.json({ success: true, data: { hasProfileImage: Boolean(profile.profileImageUrl) } });
  } catch (error) {
    return next(error);
  }
});

router.get('/students/me/profile-image', requireAuth, requireRole('STUDENT'), async (req, res, next) => {
  try {
    const publicId = req.user.studentProfile?.profileImageUrl;
    if (!publicId) return res.status(404).json({ success: false, message: 'No profile image is on file.' });
    if (!isCloudinaryConfigured()) {
      return res.status(503).json({ success: false, message: 'Image storage is not configured.' });
    }
    return res.json({
      success: true,
      data: { url: createPrivateDownloadUrl(publicId, 'jpg', { resourceType: 'image', attachment: false }) }
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/students/me/resume', requireAuth, requireRole('STUDENT'), async (req, res, next) => {
  try {
    const publicId = req.user.studentProfile?.resumeUrl;
    if (!publicId) return res.status(404).json({ success: false, message: 'No resume is on file.' });
    if (!isCloudinaryConfigured()) {
      return res.status(503).json({ success: false, message: 'Resume storage is not configured.' });
    }
    return res.json({ success: true, data: { url: createPrivateDownloadUrl(publicId, 'pdf') } });
  } catch (error) {
    return next(error);
  }
});

router.get('/students/:studentId', requireAuth, requireRole('RECRUITER', 'PLACEMENT_OFFICER'), async (req, res, next) => {
  try {
    const profile = await prisma.studentProfile.findUnique({
      where: { id: req.params.studentId },
      include: { user: { select: { email: true } } }
    });
    if (!profile) return res.status(404).json({ success: false, message: 'Student profile was not found.' });
    if (!await recruiterCanViewStudent(req, profile.id)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this student profile.' });
    }
    return res.json({
      success: true,
      data: { ...getStudentSummary(profile, false), email: profile.user.email }
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * @openapi
 * /students/{studentId}/resume:
 *   get:
 *     summary: Generate a short-lived resume URL for an authorized applicant
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Private signed download URL.
 *       403:
 *         description: Recruiter is not associated with this student's application.
 */
router.get('/students/:studentId/resume', requireAuth, requireRole('RECRUITER', 'PLACEMENT_OFFICER'), async (req, res, next) => {
  try {
    const profile = await prisma.studentProfile.findUnique({
      where: { id: req.params.studentId },
      select: { id: true, resumeUrl: true }
    });
    if (!profile) return res.status(404).json({ success: false, message: 'Student profile was not found.' });
    if (!await recruiterCanViewStudent(req, profile.id)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this resume.' });
    }
    if (!profile.resumeUrl) return res.status(404).json({ success: false, message: 'No resume is on file.' });
    if (!isCloudinaryConfigured()) return res.status(503).json({ success: false, message: 'Resume storage is not configured.' });
    return res.json({ success: true, data: { url: createPrivateDownloadUrl(profile.resumeUrl, 'pdf') } });
  } catch (error) {
    return next(error);
  }
});

export default router;
