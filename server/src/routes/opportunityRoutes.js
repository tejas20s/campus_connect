import express from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireApprovedRecruiter, requireAuth, requireRole } from '../middleware/auth.js';
import { emailLayout, sendEmail } from '../services/email.js';

const router = express.Router();

const jobInput = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(20).max(12000),
  location: z.string().trim().min(2).max(120),
  type: z.enum(['FULL_TIME', 'INTERNSHIP', 'PART_TIME', 'CONTRACT']).default('FULL_TIME'),
  salaryMin: z.number().int().nonnegative().nullable().optional(),
  salaryMax: z.number().int().nonnegative().nullable().optional(),
  deadline: z.string().datetime(),
  eligibility: z.object({
    branches: z.array(z.string().trim().min(1).max(80)).optional(),
    graduationYears: z.array(z.number().int().min(1980).max(2200)).optional(),
    minCgpa: z.number().min(0).max(10).optional(),
    skills: z.array(z.string().trim().min(1).max(80)).optional()
  }).nullable().optional(),
  isPublished: z.boolean().optional()
}).refine((job) => job.salaryMin == null || job.salaryMax == null || job.salaryMin <= job.salaryMax, {
  message: 'Minimum salary must not exceed maximum salary.',
  path: ['salaryMin']
});

const companyInput = z.object({
  name: z.string().trim().min(2).max(120),
  industry: z.string().trim().max(100).optional(),
  website: z.string().url().optional().or(z.literal('')),
  location: z.string().trim().max(120).optional(),
  description: z.string().trim().max(4000).optional()
});

const listingQuery = z.object({
  q: z.string().trim().max(120).optional(),
  location: z.string().trim().max(120).optional(),
  type: z.enum(['FULL_TIME', 'INTERNSHIP', 'PART_TIME', 'CONTRACT']).optional(),
  company: z.string().trim().max(120).optional(),
  sortBy: z.enum(['createdAt', 'deadline']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
  eligibleOnly: z.enum(['true', 'false']).default('false'),
  minimumSkillMatch: z.coerce.number().int().min(0).max(100).default(0)
});

const applicationStatusInput = z.object({
  status: z.enum(['UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'SELECTED', 'REJECTED']),
  scheduledAt: z.string().datetime().optional(),
  mode: z.string().trim().max(100).optional(),
  venue: z.string().trim().max(300).optional(),
  instructions: z.string().trim().max(2000).optional(),
  feedback: z.string().trim().max(2000).optional()
}).superRefine((data, context) => {
  if (data.status === 'INTERVIEW_SCHEDULED' && !data.scheduledAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'An interview date and time are required.',
      path: ['scheduledAt']
    });
  } else if (data.status === 'INTERVIEW_SCHEDULED' && new Date(data.scheduledAt) <= new Date()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'The interview date and time must be in the future.',
      path: ['scheduledAt']
    });
  }
});

function parsePayload(schema, body, res, message) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message, issues: parsed.error.issues });
    return null;
  }
  return parsed.data;
}

function requireRecruiterApprovalIfNeeded(req, res, next) {
  if (req.user.role === 'RECRUITER') {
    return requireApprovedRecruiter(req, res, next);
  }
  return next();
}

async function findOwnedJob(jobId, recruiter, res) {
  if (!recruiter.recruiterProfile?.companyId) {
    res.status(403).json({ success: false, message: 'Connect your recruiter account to a company before managing openings.' });
    return null;
  }

  const job = await prisma.job.findFirst({
    where: { id: jobId, companyId: recruiter.recruiterProfile.companyId }
  });
  if (!job) {
    res.status(404).json({ success: false, message: 'Job opening was not found for your company.' });
    return null;
  }
  return job;
}

function checkEligibility(criteria, student) {
  if (!criteria) return null;
  if (criteria.branches?.length && !criteria.branches.some((branch) => branch.trim().toLowerCase() === student.branch?.trim().toLowerCase())) {
    return 'Your branch does not meet this opportunity’s eligibility criteria.';
  }
  if (criteria.graduationYears?.length && !criteria.graduationYears.includes(student.graduationYear)) {
    return 'Your graduation year does not meet this opportunity’s eligibility criteria.';
  }
  if (criteria.minCgpa != null && (student.cgpa == null || student.cgpa < criteria.minCgpa)) {
    return `A minimum CGPA of ${criteria.minCgpa} is required.`;
  }
  if (criteria.skills?.length) {
    const studentSkills = new Set((student.skills || []).map((skill) => skill.trim().toLowerCase()));
    const missingSkills = criteria.skills.filter((skill) => !studentSkills.has(skill.trim().toLowerCase()));
    if (missingSkills.length) return `Missing required skills: ${missingSkills.join(', ')}.`;
  }
  return null;
}

function requireStudentForMatching(req, res, next) {
  const usesPersonalizedFilters = req.query.eligibleOnly === 'true' || Number(req.query.minimumSkillMatch) > 0;
  if (!usesPersonalizedFilters) return next();
  return requireAuth(req, res, () => requireRole('STUDENT')(req, res, next));
}

router.get('/companies', async (req, res, next) => {
  try {
    const companies = await prisma.company.findMany({
      where: { isVerified: true },
      select: { id: true, name: true, industry: true, location: true, logoUrl: true },
      orderBy: { name: 'asc' }
    });
    return res.json({ success: true, data: companies });
  } catch (error) {
    return next(error);
  }
});

/**
 * @openapi
 * /companies/mine:
 *   get:
 *     summary: Get the signed-in recruiter's company
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The recruiter's connected company, if configured.
 *       403:
 *         description: Approved recruiter role required.
 *   patch:
 *     summary: Update the signed-in recruiter's company
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, maxLength: 120 }
 *               industry: { type: string, maxLength: 100 }
 *               website: { type: string, format: uri }
 *               location: { type: string, maxLength: 120 }
 *               description: { type: string, maxLength: 4000 }
 *     responses:
 *       200:
 *         description: Company profile updated.
 *       403:
 *         description: Approved recruiter role required.
 */
router.get('/companies/mine', requireAuth, requireRole('RECRUITER'), requireApprovedRecruiter, async (req, res, next) => {
  try {
    const companyId = req.user.recruiterProfile?.companyId;
    if (!companyId) return res.json({ success: true, data: null });
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, industry: true, website: true, location: true, description: true }
    });
    return res.json({ success: true, data: company });
  } catch (error) {
    return next(error);
  }
});

router.post('/companies', requireAuth, requireRole('RECRUITER'), requireApprovedRecruiter, async (req, res, next) => {
  try {
    if (!req.user.recruiterProfile || req.user.recruiterProfile.companyId) {
      return res.status(409).json({ success: false, message: 'Your account is already connected to a company.' });
    }

    const payload = parsePayload(companyInput, req.body, res, 'Invalid company details.');
    if (!payload) return;

    const company = await prisma.company.create({
      data: {
        ...payload,
        website: payload.website || null,
        recruiters: { connect: { id: req.user.recruiterProfile.id } }
      }
    });
    return res.status(201).json({ success: true, data: company });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'A company with that name already exists. Ask an administrator to connect your account.' });
    }
    return next(error);
  }
});

router.patch('/companies/mine', requireAuth, requireRole('RECRUITER'), requireApprovedRecruiter, async (req, res, next) => {
  try {
    const companyId = req.user.recruiterProfile?.companyId;
    if (!companyId) {
      return res.status(404).json({ success: false, message: 'Your recruiter account is not connected to a company.' });
    }
    const payload = parsePayload(companyInput.partial(), req.body, res, 'Invalid company updates.');
    if (!payload) return;
    const company = await prisma.company.update({
      where: { id: companyId },
      data: { ...payload, ...(payload.website !== undefined && { website: payload.website || null }) }
    });
    return res.json({ success: true, data: company });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'A company with that name already exists.' });
    }
    return next(error);
  }
});

router.get('/jobs/mine', requireAuth, requireRole('RECRUITER'), requireApprovedRecruiter, async (req, res, next) => {
  try {
    const companyId = req.user.recruiterProfile?.companyId;
    if (!companyId) return res.json({ success: true, data: [] });
    const jobs = await prisma.job.findMany({
      where: { companyId },
      include: {
        _count: { select: { applications: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.json({ success: true, data: jobs });
  } catch (error) {
    return next(error);
  }
});

/**
 * @openapi
 * /jobs:
 *   get:
 *     summary: Search and paginate published job opportunities
 *     description: Personalized eligibility and minimum-skill-match filters require an authenticated student account.
 *     tags: [Jobs]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: location
 *         schema: { type: string }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [FULL_TIME, INTERNSHIP, PART_TIME, CONTRACT] }
 *       - in: query
 *         name: eligibleOnly
 *         schema: { type: boolean, default: false }
 *       - in: query
 *         name: minimumSkillMatch
 *         schema: { type: integer, minimum: 0, maximum: 100, default: 0 }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, minimum: 1, maximum: 50, default: 12 }
 *     responses:
 *       200:
 *         description: Published jobs and matching pagination metadata.
 *       401:
 *         description: Authentication required for personalized filters.
 *       403:
 *         description: Personalized filters are available to students only.
 */
router.get('/jobs', requireStudentForMatching, async (req, res, next) => {
  try {
    const query = listingQuery.safeParse(req.query);
    if (!query.success) {
      return res.status(400).json({ success: false, message: 'Invalid job filters.', issues: query.error.issues });
    }

    const { q, location, type, company, sortBy, order, page, pageSize, eligibleOnly, minimumSkillMatch } = query.data;
    const where = {
      isPublished: true,
      isArchived: false,
      deadline: { gte: new Date() },
      ...(type && { type }),
      ...(location && { location: { contains: location, mode: 'insensitive' } }),
      ...(company && { company: { name: { contains: company, mode: 'insensitive' } } }),
      ...(q && {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { company: { name: { contains: q, mode: 'insensitive' } } }
        ]
      })
    };
    if (eligibleOnly === 'true' || minimumSkillMatch > 0) {
      const student = req.user.studentProfile;
      if (!student) {
        return res.status(403).json({ success: false, message: 'A student profile is required for personalized job filters.' });
      }
      const candidates = await prisma.job.findMany({
        where,
        include: { company: { select: { id: true, name: true, industry: true, location: true, logoUrl: true } } },
        orderBy: { [sortBy]: order }
      });
      const matchingJobs = candidates.filter((job) => {
        if (eligibleOnly === 'true' && checkEligibility(job.eligibility, student)) return false;
        const skills = job.eligibility?.skills || [];
        if (!skills.length) return true;
        const studentSkills = new Set((student.skills || []).map((skill) => skill.trim().toLowerCase()));
        const matchedCount = skills.filter((skill) => studentSkills.has(skill.trim().toLowerCase())).length;
        return (matchedCount / skills.length) * 100 >= minimumSkillMatch;
      });
      const skip = (page - 1) * pageSize;
      return res.json({
        success: true,
        data: matchingJobs.slice(skip, skip + pageSize),
        pagination: {
          page,
          pageSize,
          total: matchingJobs.length,
          totalPages: Math.ceil(matchingJobs.length / pageSize)
        }
      });
    }
    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: { company: { select: { id: true, name: true, industry: true, location: true, logoUrl: true } } },
        orderBy: { [sortBy]: order },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.job.count({ where })
    ]);

    return res.json({
      success: true,
      data: jobs,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/jobs/:jobId', async (req, res, next) => {
  try {
    const job = await prisma.job.findFirst({
      where: {
        id: req.params.jobId,
        isPublished: true,
        isArchived: false,
        deadline: { gte: new Date() }
      },
      include: { company: { select: { id: true, name: true, industry: true, location: true, website: true, description: true, logoUrl: true } } }
    });
    if (!job) return res.status(404).json({ success: false, message: 'Job opening was not found.' });
    return res.json({ success: true, data: job });
  } catch (error) {
    return next(error);
  }
});

router.post('/jobs', requireAuth, requireRole('RECRUITER', 'PLACEMENT_OFFICER'), requireRecruiterApprovalIfNeeded, async (req, res, next) => {
  try {
    const companyId = req.user.role === 'RECRUITER'
      ? req.user.recruiterProfile?.companyId
      : req.body.companyId;
    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Connect this account to a company before publishing jobs.' });
    }

    const payload = parsePayload(jobInput, req.body, res, 'Invalid job details.');
    if (!payload) return;
    if (new Date(payload.deadline) <= new Date()) {
      return res.status(400).json({ success: false, message: 'The application deadline must be in the future.' });
    }

    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) return res.status(404).json({ success: false, message: 'Company was not found.' });
    const { isPublished = false, ...jobData } = payload;
    const job = await prisma.job.create({
      data: {
        ...jobData,
        deadline: new Date(jobData.deadline),
        companyId,
        isPublished: req.user.role === 'PLACEMENT_OFFICER' ? isPublished : false
      },
      include: { company: { select: { id: true, name: true } } }
    });
    return res.status(201).json({ success: true, data: job });
  } catch (error) {
    return next(error);
  }
});

router.patch('/jobs/:jobId', requireAuth, requireRole('RECRUITER', 'PLACEMENT_OFFICER'), requireRecruiterApprovalIfNeeded, async (req, res, next) => {
  try {
    let currentJob;
    if (req.user.role === 'RECRUITER') {
      currentJob = await findOwnedJob(req.params.jobId, req.user, res);
    } else {
      currentJob = await prisma.job.findUnique({ where: { id: req.params.jobId } });
      if (!currentJob) return res.status(404).json({ success: false, message: 'Job opening was not found.' });
    }
    if (!currentJob) return;

    const payload = parsePayload(jobInput.partial(), req.body, res, 'Invalid job updates.');
    if (!payload) return;
    if (payload.deadline && new Date(payload.deadline) <= new Date()) {
      return res.status(400).json({ success: false, message: 'The application deadline must be in the future.' });
    }
    const { isPublished, ...jobData } = payload;
    const job = await prisma.job.update({
      where: { id: currentJob.id },
      data: {
        ...jobData,
        ...(jobData.deadline && { deadline: new Date(jobData.deadline) }),
        ...(isPublished !== undefined && { isPublished })
      }
    });
    return res.json({ success: true, data: job });
  } catch (error) {
    return next(error);
  }
});

router.delete('/jobs/:jobId', requireAuth, requireRole('RECRUITER', 'PLACEMENT_OFFICER'), requireRecruiterApprovalIfNeeded, async (req, res, next) => {
  try {
    if (req.user.role === 'RECRUITER') {
      const ownedJob = await findOwnedJob(req.params.jobId, req.user, res);
      if (!ownedJob) return;
    }
    const job = await prisma.job.update({
      where: { id: req.params.jobId },
      data: { isArchived: true, isPublished: false }
    });
    return res.json({ success: true, data: job, message: 'Job opening archived.' });
  } catch (error) {
    return next(error);
  }
});

router.post('/jobs/:jobId/applications', requireAuth, requireRole('STUDENT'), async (req, res, next) => {
  try {
    const student = req.user.studentProfile;
    if (!student) return res.status(403).json({ success: false, message: 'A student profile is required to apply.' });
    const job = await prisma.job.findFirst({
      where: {
        id: req.params.jobId,
        isPublished: true,
        isArchived: false,
        deadline: { gt: new Date() }
      }
    });
    if (!job) return res.status(404).json({ success: false, message: 'This job is unavailable or its deadline has passed.' });

    const eligibilityError = checkEligibility(job.eligibility, student);
    if (eligibilityError) return res.status(400).json({ success: false, message: eligibilityError });

    const existingApplication = await prisma.application.findUnique({
      where: { jobId_studentId: { jobId: job.id, studentId: student.id } },
      select: { id: true }
    });
    if (existingApplication) {
      return res.status(409).json({ success: false, message: 'You have already applied for this opportunity.' });
    }

    const application = await prisma.$transaction(async (transaction) => {
      const created = await transaction.application.create({
        data: {
          jobId: job.id,
          studentId: student.id,
          resumeUrl: student.resumeUrl
        },
        include: { job: { include: { company: { select: { name: true } } } } }
      });
      await transaction.applicationStatusEvent.create({
        data: { applicationId: created.id, status: 'APPLIED', actorId: req.user.id }
      });
      await transaction.notification.create({
        data: {
          userId: req.user.id,
          title: 'Application submitted',
          message: `Your application for ${job.title} was submitted successfully.`,
          link: '/applications'
        }
      });
      return created;
    });
    await sendEmail({
      to: req.user.email,
      subject: `Application received: ${job.title}`,
      html: emailLayout('Application received', `Your application for ${job.title} at ${application.job.company.name} has been submitted.`)
    });
    return res.status(201).json({ success: true, data: application });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'You have already applied for this opportunity.' });
    }
    return next(error);
  }
});

/**
 * @openapi
 * /applications/my:
 *   get:
 *     summary: List the signed-in student's applications, interview details, and status timeline
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Applications are scoped to the authenticated student.
 */
router.get('/applications/my', requireAuth, requireRole('STUDENT'), async (req, res, next) => {
  try {
    if (!req.user.studentProfile) {
      return res.status(403).json({ success: false, message: 'A student profile is required to view applications.' });
    }
    const applications = await prisma.application.findMany({
      where: { studentId: req.user.studentProfile.id },
      include: {
        job: { include: { company: { select: { id: true, name: true, logoUrl: true } } } },
        interview: true,
        statusHistory: { orderBy: { createdAt: 'asc' } }
      },
      orderBy: { appliedAt: 'desc' }
    });
    return res.json({ success: true, data: applications });
  } catch (error) {
    return next(error);
  }
});

router.get('/jobs/:jobId/applications', requireAuth, requireRole('RECRUITER', 'PLACEMENT_OFFICER'), requireRecruiterApprovalIfNeeded, async (req, res, next) => {
  try {
    if (req.user.role === 'RECRUITER') {
      const job = await findOwnedJob(req.params.jobId, req.user, res);
      if (!job) return;
    }
    const applications = await prisma.application.findMany({
      where: { jobId: req.params.jobId },
      select: {
        id: true,
        status: true,
        appliedAt: true,
        updatedAt: true,
        coverLetter: true,
        student: {
          select: {
            id: true,
            fullName: true,
            branch: true,
            graduationYear: true,
            cgpa: true,
            skills: true,
            user: { select: { email: true } }
          }
        },
        interview: true,
        job: { select: { title: true } }
      },
      orderBy: { appliedAt: 'desc' }
    });
    return res.json({ success: true, data: applications });
  } catch (error) {
    return next(error);
  }
});

/**
 * @openapi
 * /applications/{applicationId}/status:
 *   patch:
 *     summary: Update an application status and append student-visible recruiter feedback
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
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
 *               status: { type: string }
 *               feedback: { type: string, maxLength: 2000 }
 *               scheduledAt: { type: string, format: date-time }
 *               mode: { type: string }
 *               venue: { type: string }
 *               instructions: { type: string }
 *     responses:
 *       200:
 *         description: Updated status and status history.
 *       403:
 *         description: Recruiter does not own the job.
 */
router.patch('/applications/:applicationId/status', requireAuth, requireRole('RECRUITER', 'PLACEMENT_OFFICER'), requireRecruiterApprovalIfNeeded, async (req, res, next) => {
  try {
    const payload = parsePayload(applicationStatusInput, req.body, res, 'Invalid application status update.');
    if (!payload) return;
    const application = await prisma.application.findUnique({
      where: { id: req.params.applicationId },
      include: {
        job: true,
        student: { include: { user: { select: { id: true, email: true } } } }
      }
    });
    if (!application) return res.status(404).json({ success: false, message: 'Application was not found.' });

    if (req.user.role === 'RECRUITER') {
      if (req.user.recruiterProfile?.companyId !== application.job.companyId) {
        return res.status(403).json({ success: false, message: 'You may only manage applications for your company openings.' });
      }
    }

    const allowedNextStatuses = {
      APPLIED: ['UNDER_REVIEW', 'SHORTLISTED', 'REJECTED'],
      UNDER_REVIEW: ['SHORTLISTED', 'REJECTED'],
      SHORTLISTED: ['INTERVIEW_SCHEDULED', 'SELECTED', 'REJECTED'],
      INTERVIEW_SCHEDULED: ['INTERVIEW_SCHEDULED', 'SELECTED', 'REJECTED']
    };
    if (!allowedNextStatuses[application.status]?.includes(payload.status)) {
      return res.status(409).json({ success: false, message: `Cannot move an application from ${application.status} to ${payload.status}.` });
    }

    const updated = await prisma.$transaction(async (transaction) => {
      if (payload.status === 'INTERVIEW_SCHEDULED') {
        const { scheduledAt, ...interviewDetails } = payload;
        await transaction.interview.upsert({
          where: { applicationId: application.id },
          create: { applicationId: application.id, scheduledAt: new Date(scheduledAt), ...interviewDetails },
          update: { scheduledAt: new Date(scheduledAt), ...interviewDetails, status: 'SCHEDULED' }
        });
      }
      await transaction.applicationStatusEvent.create({
        data: {
          applicationId: application.id,
          status: payload.status,
          feedback: payload.feedback || null,
          actorId: req.user.id
        }
      });
      const updatedApplication = await transaction.application.update({
        where: { id: application.id },
        data: { status: payload.status },
        include: { interview: true, statusHistory: { orderBy: { createdAt: 'asc' } } }
      });
      await transaction.notification.create({
        data: {
          userId: application.student.user.id,
          title: 'Application status updated',
          message: [
            `Your application for ${application.job.title} is now ${payload.status.replaceAll('_', ' ').toLowerCase()}.`,
            payload.feedback && `Recruiter feedback: ${payload.feedback}`
          ].filter(Boolean).join(' '),
          link: '/applications'
        }
      });
      return updatedApplication;
    });
    if (payload.status === 'INTERVIEW_SCHEDULED') {
      await sendEmail({
        to: application.student.user.email,
        subject: `Interview scheduled: ${application.job.title}`,
        html: emailLayout(
          'Interview scheduled',
          [
            `Your interview for ${application.job.title} is scheduled for ${new Date(payload.scheduledAt).toLocaleString()}.`,
            payload.mode && `Format: ${payload.mode}.`,
            payload.venue && `Location or meeting link: ${payload.venue}.`,
            payload.instructions && `Candidate instructions: ${payload.instructions}`
          ].filter(Boolean).join(' ')
        )
      });
    } else {
      await sendEmail({
        to: application.student.user.email,
        subject: `Application update: ${application.job.title}`,
        html: emailLayout(
          'Application update',
          [
            `Your application for ${application.job.title} is now ${payload.status.replaceAll('_', ' ').toLowerCase()}.`,
            payload.feedback && `Recruiter feedback: ${payload.feedback}`
          ].filter(Boolean).join(' ')
        )
      });
    }
    return res.json({ success: true, data: updated });
  } catch (error) {
    return next(error);
  }
});

router.delete('/applications/:applicationId/interview', requireAuth, requireRole('RECRUITER', 'PLACEMENT_OFFICER'), requireRecruiterApprovalIfNeeded, async (req, res, next) => {
  try {
    const application = await prisma.application.findUnique({
      where: { id: req.params.applicationId },
      include: {
        job: true,
        student: { include: { user: { select: { id: true, email: true } } } },
        interview: true
      }
    });
    if (!application) return res.status(404).json({ success: false, message: 'Application was not found.' });
    if (req.user.role === 'RECRUITER' && req.user.recruiterProfile?.companyId !== application.job.companyId) {
      return res.status(403).json({ success: false, message: 'You may only manage interviews for your company openings.' });
    }
    if (application.status !== 'INTERVIEW_SCHEDULED' || !application.interview) {
      return res.status(409).json({ success: false, message: 'This application does not have an active scheduled interview.' });
    }

    const updated = await prisma.$transaction(async (transaction) => {
      const interview = await transaction.interview.update({
        where: { applicationId: application.id },
        data: { status: 'CANCELLED' }
      });
      await transaction.applicationStatusEvent.create({
        data: {
          applicationId: application.id,
          status: 'SHORTLISTED',
          feedback: 'The scheduled interview was cancelled.',
          actorId: req.user.id
        }
      });
      const updatedApplication = await transaction.application.update({
        where: { id: application.id },
        data: { status: 'SHORTLISTED' },
        include: { interview: true, statusHistory: { orderBy: { createdAt: 'asc' } } }
      });
      await transaction.notification.create({
        data: {
          userId: application.student.user.id,
          title: 'Interview cancelled',
          message: `The interview for ${application.job.title} was cancelled.`,
          link: '/applications'
        }
      });
      return { interview, application: updatedApplication };
    });
    await sendEmail({
      to: application.student.user.email,
      subject: `Interview cancelled: ${application.job.title}`,
      html: emailLayout('Interview cancelled', `The scheduled interview for ${application.job.title} has been cancelled.`)
    });
    return res.json({ success: true, data: updated });
  } catch (error) {
    return next(error);
  }
});

router.post('/applications/:applicationId/withdraw', requireAuth, requireRole('STUDENT'), async (req, res, next) => {
  try {
    const student = req.user.studentProfile;
    if (!student) return res.status(403).json({ success: false, message: 'A student profile is required.' });
    const application = await prisma.application.findFirst({
      where: { id: req.params.applicationId, studentId: student.id }
    });
    if (!application) return res.status(404).json({ success: false, message: 'Application was not found.' });
    if (['SELECTED', 'REJECTED', 'WITHDRAWN'].includes(application.status)) {
      return res.status(409).json({ success: false, message: `An application with status ${application.status} cannot be withdrawn.` });
    }
    const updated = await prisma.$transaction(async (transaction) => {
      await transaction.applicationStatusEvent.create({
        data: { applicationId: application.id, status: 'WITHDRAWN', actorId: req.user.id }
      });
      const withdrawn = await transaction.application.update({
        where: { id: application.id },
        data: { status: 'WITHDRAWN' },
        include: { interview: true, statusHistory: { orderBy: { createdAt: 'asc' } } }
      });
      return withdrawn;
    });
    return res.json({ success: true, data: updated });
  } catch (error) {
    return next(error);
  }
});

export default router;
