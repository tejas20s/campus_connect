import express from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

const publicFields = {
  id: true,
  fullName: true,
  graduationYear: true,
  department: true,
  currentCompany: true,
  jobTitle: true,
  skills: true,
  bio: true,
  linkedinUrl: true,
  website: true
};

const listingQuery = z.object({
  q: z.string().trim().max(120).optional(),
  department: z.string().trim().max(100).optional(),
  company: z.string().trim().max(120).optional(),
  skill: z.string().trim().max(80).optional(),
  graduationYear: z.coerce.number().int().min(1980).max(2200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12)
});

const profileInput = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  graduationYear: z.number().int().min(1980).max(2200).nullable().optional(),
  department: z.string().trim().max(100).nullable().optional(),
  currentCompany: z.string().trim().max(120).nullable().optional(),
  jobTitle: z.string().trim().max(120).nullable().optional(),
  skills: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  bio: z.string().trim().max(2000).nullable().optional(),
  linkedinUrl: z.string().url().nullable().optional(),
  website: z.string().url().nullable().optional(),
  isPublic: z.boolean().optional()
}).strict().refine((payload) => Object.keys(payload).length > 0, {
  message: 'At least one profile field must be provided.'
});

const mentorshipInput = z.object({
  alumniId: z.string().trim().min(1),
  message: z.string().trim().min(10).max(2000)
}).strict();

const decisionInput = z.object({
  status: z.enum(['ACCEPTED', 'DECLINED'])
}).strict();

function parseInput(schema, input, res, message) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    res.status(400).json({ success: false, message, issues: parsed.error.issues });
    return null;
  }
  return parsed.data;
}

/**
 * @openapi
 * /alumni:
 *   get:
 *     summary: Search public alumni profiles
 *     tags: [Alumni]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: department
 *         schema: { type: string }
 *       - in: query
 *         name: graduationYear
 *         schema: { type: integer }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, minimum: 1, maximum: 50 }
 *     responses:
 *       200:
 *         description: Public-safe alumni profiles and pagination metadata.
 *       400:
 *         description: Invalid filters.
 */
router.get('/alumni', async (req, res, next) => {
  try {
    const query = parseInput(listingQuery, req.query, res, 'Invalid alumni search filters.');
    if (!query) return;

    const searchTerms = query.q
      ? ['fullName', 'department', 'currentCompany', 'jobTitle', 'bio'].map((field) => ({
        [field]: { contains: query.q, mode: 'insensitive' }
      }))
      : [];
    const where = {
      isPublic: true,
      ...(query.department ? { department: { contains: query.department, mode: 'insensitive' } } : {}),
      ...(query.company ? { currentCompany: { contains: query.company, mode: 'insensitive' } } : {}),
      ...(query.skill ? { skills: { has: query.skill } } : {}),
      ...(query.graduationYear ? { graduationYear: query.graduationYear } : {}),
      ...(searchTerms.length ? { OR: searchTerms } : {})
    };
    const skip = (query.page - 1) * query.pageSize;
    const [profiles, total] = await prisma.$transaction([
      prisma.alumniProfile.findMany({
        where,
        select: publicFields,
        orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
        skip,
        take: query.pageSize
      }),
      prisma.alumniProfile.count({ where })
    ]);

    return res.json({
      success: true,
      data: profiles,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize)
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/alumni/me', requireAuth, requireRole('ALUMNI'), async (req, res, next) => {
  try {
    if (!req.user.alumniProfile) {
      return res.status(404).json({ success: false, message: 'Alumni profile was not found.' });
    }
    const profile = await prisma.alumniProfile.findUnique({
      where: { id: req.user.alumniProfile.id },
      select: { ...publicFields, isPublic: true, createdAt: true, updatedAt: true }
    });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Alumni profile was not found.' });
    }
    return res.json({ success: true, data: profile });
  } catch (error) {
    return next(error);
  }
});

router.patch('/alumni/me', requireAuth, requireRole('ALUMNI'), async (req, res, next) => {
  try {
    if (!req.user.alumniProfile) {
      return res.status(404).json({ success: false, message: 'Alumni profile was not found.' });
    }
    const payload = parseInput(profileInput, req.body, res, 'Invalid alumni profile details.');
    if (!payload) return;

    const profile = await prisma.alumniProfile.update({
      where: { id: req.user.alumniProfile.id },
      data: payload,
      select: { ...publicFields, isPublic: true, createdAt: true, updatedAt: true }
    });
    return res.json({ success: true, data: profile });
  } catch (error) {
    return next(error);
  }
});

router.get('/alumni/:alumniId', async (req, res, next) => {
  try {
    const profile = await prisma.alumniProfile.findFirst({
      where: { id: req.params.alumniId, isPublic: true },
      select: publicFields
    });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Public alumni profile was not found.' });
    }
    return res.json({ success: true, data: profile });
  } catch (error) {
    return next(error);
  }
});

/**
 * @openapi
 * /mentorship-requests:
 *   post:
 *     summary: Request mentorship from a public alumni profile
 *     tags: [Mentorship]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [alumniId, message]
 *             properties:
 *               alumniId: { type: string }
 *               message: { type: string, minLength: 10, maxLength: 2000 }
 *     responses:
 *       201:
 *         description: Request created.
 *       409:
 *         description: An active request already exists.
 */
router.post('/mentorship-requests', requireAuth, requireRole('STUDENT'), async (req, res, next) => {
  try {
    if (!req.user.studentProfile) {
      return res.status(404).json({ success: false, message: 'Student profile was not found.' });
    }
    const payload = parseInput(mentorshipInput, req.body, res, 'Invalid mentorship request.');
    if (!payload) return;

    const alumni = await prisma.alumniProfile.findFirst({
      where: { id: payload.alumniId, isPublic: true },
      select: { id: true, userId: true, fullName: true }
    });
    if (!alumni) {
      return res.status(404).json({ success: false, message: 'Public alumni profile was not found.' });
    }

    const result = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.mentorshipRequest.findFirst({
        where: {
          studentId: req.user.studentProfile.id,
          alumniId: alumni.id,
          status: { in: ['PENDING', 'ACCEPTED'] }
        },
        select: { id: true }
      });
      if (existing) return { duplicate: true };

      const mentorshipRequest = await transaction.mentorshipRequest.create({
        data: {
          studentId: req.user.studentProfile.id,
          alumniId: alumni.id,
          message: payload.message
        },
        select: {
          id: true,
          message: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          alumni: { select: publicFields }
        }
      });
      await transaction.notification.create({
        data: {
          userId: alumni.userId,
          title: 'New mentorship request',
          message: `${req.user.studentProfile.fullName} sent you a mentorship request.`,
          link: '/mentorship-requests'
        }
      });
      return { mentorshipRequest };
    }, { isolationLevel: 'Serializable' });

    if (result.duplicate) {
      return res.status(409).json({
        success: false,
        message: 'A pending or accepted mentorship request already exists for this alumni.'
      });
    }
    return res.status(201).json({ success: true, data: result.mentorshipRequest });
  } catch (error) {
    if (error.code === 'P2034') {
      return res.status(409).json({
        success: false,
        message: 'A concurrent update prevented this request. Please retry.'
      });
    }
    return next(error);
  }
});

router.get('/mentorship-requests', requireAuth, requireRole('STUDENT', 'ALUMNI'), async (req, res, next) => {
  try {
    let where;
    if (req.user.role === 'STUDENT') {
      if (!req.user.studentProfile) {
        return res.status(404).json({ success: false, message: 'Student profile was not found.' });
      }
      where = { studentId: req.user.studentProfile.id };
    } else {
      if (!req.user.alumniProfile) {
        return res.status(404).json({ success: false, message: 'Alumni profile was not found.' });
      }
      where = { alumniId: req.user.alumniProfile.id };
    }

    const requests = await prisma.mentorshipRequest.findMany({
      where,
      select: {
        id: true,
        message: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        student: { select: { id: true, fullName: true, branch: true, graduationYear: true } },
        alumni: { select: publicFields }
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.json({ success: true, data: requests });
  } catch (error) {
    return next(error);
  }
});

/**
 * @openapi
 * /mentorship-requests/{requestId}:
 *   patch:
 *     summary: Accept or decline a pending mentorship request
 *     tags: [Mentorship]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [ACCEPTED, DECLINED] }
 *     responses:
 *       200:
 *         description: Updated request.
 *       403:
 *         description: Request belongs to another alumni profile.
 *       409:
 *         description: Request is no longer pending.
 */
router.patch('/mentorship-requests/:requestId', requireAuth, requireRole('ALUMNI'), async (req, res, next) => {
  try {
    if (!req.user.alumniProfile) {
      return res.status(404).json({ success: false, message: 'Alumni profile was not found.' });
    }
    const payload = parseInput(decisionInput, req.body, res, 'Invalid mentorship request decision.');
    if (!payload) return;

    const result = await prisma.$transaction(async (transaction) => {
      const mentorshipRequest = await transaction.mentorshipRequest.findFirst({
        where: { id: req.params.requestId, alumniId: req.user.alumniProfile.id },
        select: {
          id: true,
          studentId: true,
          message: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          student: { select: { id: true, userId: true, fullName: true, branch: true, graduationYear: true } },
          alumni: { select: publicFields }
        }
      });
      if (!mentorshipRequest) return { notFound: true };
      if (mentorshipRequest.status !== 'PENDING') return { conflict: true };

      const updated = await transaction.mentorshipRequest.updateMany({
        where: {
          id: mentorshipRequest.id,
          alumniId: req.user.alumniProfile.id,
          status: 'PENDING'
        },
        data: { status: payload.status }
      });
      if (updated.count !== 1) return { conflict: true };

      await transaction.notification.create({
        data: {
          userId: mentorshipRequest.student.userId,
          title: `Mentorship request ${payload.status.toLowerCase()}`,
          message: `${mentorshipRequest.alumni.fullName} ${payload.status.toLowerCase()} your mentorship request.`,
          link: '/mentorship-requests'
        }
      });
      return {
        data: {
          ...mentorshipRequest,
          student: {
            id: mentorshipRequest.student.id,
            fullName: mentorshipRequest.student.fullName,
            branch: mentorshipRequest.student.branch,
            graduationYear: mentorshipRequest.student.graduationYear
          },
          status: payload.status,
          updatedAt: new Date()
        }
      };
    });

    if (result.notFound) {
      return res.status(404).json({ success: false, message: 'Mentorship request was not found.' });
    }
    if (result.conflict) {
      return res.status(409).json({
        success: false,
        message: 'Only pending mentorship requests can be accepted or declined.'
      });
    }
    return res.json({ success: true, data: result.data });
  } catch (error) {
    return next(error);
  }
});

export default router;
