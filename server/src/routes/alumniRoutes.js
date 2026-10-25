import express from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
const safeWebUrl = z.string().url().max(1000).refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), {
  message: 'Only HTTP or HTTPS links are accepted.'
});

const publicFields = {
  id: true,
  fullName: true,
  graduationYear: true,
  department: true,
  currentCompany: true,
  jobTitle: true,
  skills: true,
  mentoringTopics: true,
  professionalExperience: true,
  bio: true,
  linkedinUrl: true,
  website: true,
  isVerified: true
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
  mentoringTopics: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
  professionalExperience: z.string().trim().max(5000).nullable().optional(),
  bio: z.string().trim().max(2000).nullable().optional(),
  linkedinUrl: safeWebUrl.nullable().optional(),
  website: safeWebUrl.nullable().optional(),
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

const resourceInput = z.object({
  title: z.string().trim().min(3).max(160),
  summary: z.string().trim().min(10).max(2000),
  url: safeWebUrl,
  category: z.string().trim().min(2).max(80)
}).strict();

const opportunityInput = z.object({
  title: z.string().trim().min(3).max(160),
  company: z.string().trim().min(2).max(160),
  location: z.string().trim().min(2).max(160),
  type: z.enum(['FULL_TIME', 'INTERNSHIP', 'PART_TIME', 'CONTRACT']),
  url: safeWebUrl,
  details: z.string().trim().min(10).max(2000)
}).strict();

const volunteerInput = z.object({
  note: z.string().trim().max(1000).optional()
}).strict();

const messageInput = z.object({
  content: z.string().trim().min(1).max(4000)
}).strict();

const reviewInput = z.object({
  status: z.enum(['APPROVED', 'REJECTED'])
}).strict();

function parseInput(schema, input, res, message) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    res.status(400).json({ success: false, message, issues: parsed.error.issues });
    return null;
  }
  return parsed.data;
}

async function findAlumniSkillMatchIds(term) {
  const matches = await prisma.$queryRaw`
    SELECT "id"
    FROM "AlumniProfile"
    WHERE "isPublic" = TRUE
      AND (
        EXISTS (SELECT 1 FROM unnest("AlumniProfile"."skills") AS skill(value) WHERE LOWER(skill.value) = LOWER(${term}))
        OR EXISTS (SELECT 1 FROM unnest("AlumniProfile"."mentoringTopics") AS topic(value) WHERE LOWER(topic.value) = LOWER(${term}))
      )
  `;
  return matches.map(({ id }) => id);
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
      ? [
        ...['fullName', 'department', 'currentCompany', 'jobTitle', 'bio', 'professionalExperience'].map((field) => ({
          [field]: { contains: query.q, mode: 'insensitive' }
        })),
        { id: { in: await findAlumniSkillMatchIds(query.q) } }
      ]
      : [];
    const filterGroups = [];
    if (searchTerms.length) filterGroups.push({ OR: searchTerms });
    if (query.skill) {
      filterGroups.push({ id: { in: await findAlumniSkillMatchIds(query.skill) } });
    }
    const where = {
      isPublic: true,
      ...(query.department ? { department: { contains: query.department, mode: 'insensitive' } } : {}),
      ...(query.company ? { currentCompany: { contains: query.company, mode: 'insensitive' } } : {}),
      ...(query.graduationYear ? { graduationYear: query.graduationYear } : {}),
      ...(filterGroups.length ? { AND: filterGroups } : {})
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

/**
 * @openapi
 * /alumni/dashboard:
 *   get:
 *     summary: Get the signed-in alumni workspace overview
 *     tags: [Alumni]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile completion, mentorship activity, reviewed contributions, and upcoming drives.
 *       403:
 *         description: Alumni role required.
 */
router.get('/alumni/dashboard', requireAuth, requireRole('ALUMNI'), async (req, res, next) => {
  try {
    const profile = req.user.alumniProfile;
    if (!profile) return res.status(404).json({ success: false, message: 'Alumni profile was not found.' });

    const [requests, resources, recommendations, volunteering, drives] = await Promise.all([
      prisma.mentorshipRequest.findMany({
        where: { alumniId: profile.id },
        select: {
          id: true,
          status: true,
          message: true,
          createdAt: true,
          student: { select: { id: true, fullName: true, branch: true, graduationYear: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 8
      }),
      prisma.careerResource.findMany({
        where: { alumniId: profile.id },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      prisma.opportunityRecommendation.findMany({
        where: { alumniId: profile.id },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      prisma.driveVolunteer.findMany({
        where: { alumniId: profile.id },
        include: { drive: { select: { id: true, title: true, date: true, location: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      prisma.placementDrive.findMany({
        where: { isPublished: true, date: { gte: new Date() } },
        include: { company: { select: { name: true } } },
        orderBy: { date: 'asc' },
        take: 20
      })
    ]);

    const profileFields = [
      profile.fullName,
      profile.graduationYear,
      profile.department,
      profile.currentCompany,
      profile.jobTitle,
      profile.skills.length,
      profile.mentoringTopics.length,
      profile.professionalExperience,
      profile.bio,
      profile.linkedinUrl
    ];
    const completion = Math.round((profileFields.filter(Boolean).length / profileFields.length) * 100);

    return res.json({
      success: true,
      data: {
        profile: {
          id: profile.id,
          fullName: profile.fullName,
          isPublic: profile.isPublic,
          isVerified: profile.isVerified,
          completion
        },
        mentorship: {
          pending: requests.filter((request) => request.status === 'PENDING').length,
          accepted: requests.filter((request) => request.status === 'ACCEPTED').length,
          recentRequests: requests
        },
        resources,
        recommendations,
        volunteering,
        upcomingDrives: drives
      }
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * @openapi
 * /career-resources:
 *   get:
 *     summary: List Placement Office-approved alumni career resources
 *     tags: [Alumni]
 *     responses:
 *       200:
 *         description: Approved resources only.
 *   post:
 *     summary: Submit an alumni resource for review
 *     tags: [Alumni]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Resource submitted with PENDING review status.
 *       403:
 *         description: Alumni role required.
 */
router.get('/career-resources', async (req, res, next) => {
  try {
    const resources = await prisma.careerResource.findMany({
      where: { status: 'APPROVED' },
      select: { id: true, title: true, summary: true, url: true, category: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    return res.json({ success: true, data: resources });
  } catch (error) {
    return next(error);
  }
});

router.post('/career-resources', requireAuth, requireRole('ALUMNI'), async (req, res, next) => {
  try {
    const profile = req.user.alumniProfile;
    if (!profile) return res.status(404).json({ success: false, message: 'Alumni profile was not found.' });
    const payload = parseInput(resourceInput, req.body, res, 'Invalid career resource.');
    if (!payload) return;
    const resource = await prisma.careerResource.create({
      data: { ...payload, alumniId: profile.id }
    });
    return res.status(201).json({ success: true, data: resource, message: 'Resource submitted for placement-office review.' });
  } catch (error) {
    return next(error);
  }
});

/**
 * @openapi
 * /opportunity-recommendations:
 *   get:
 *     summary: List approved alumni opportunity recommendations
 *     tags: [Alumni]
 *     responses:
 *       200:
 *         description: Approved recommendations, distinct from verified job postings.
 *   post:
 *     summary: Submit an opportunity recommendation for Placement Office review
 *     tags: [Alumni]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Recommendation submitted with PENDING review status.
 */
router.get('/opportunity-recommendations', async (req, res, next) => {
  try {
    const recommendations = await prisma.opportunityRecommendation.findMany({
      where: { status: 'APPROVED' },
      select: {
        id: true,
        title: true,
        company: true,
        location: true,
        type: true,
        url: true,
        details: true,
        createdAt: true,
        alumni: { select: { fullName: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    return res.json({ success: true, data: recommendations });
  } catch (error) {
    return next(error);
  }
});

router.post('/opportunity-recommendations', requireAuth, requireRole('ALUMNI'), async (req, res, next) => {
  try {
    const profile = req.user.alumniProfile;
    if (!profile) return res.status(404).json({ success: false, message: 'Alumni profile was not found.' });
    const payload = parseInput(opportunityInput, req.body, res, 'Invalid opportunity recommendation.');
    if (!payload) return;
    const recommendation = await prisma.opportunityRecommendation.create({
      data: { ...payload, alumniId: profile.id }
    });
    return res.status(201).json({
      success: true,
      data: recommendation,
      message: 'Opportunity recommendation submitted for placement-office review.'
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * @openapi
 * /placement-drives/{driveId}/volunteer:
 *   post:
 *     summary: Request to volunteer at an upcoming placement event
 *     tags: [Alumni]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: driveId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       201:
 *         description: Volunteer request submitted for Placement Office review.
 *       409:
 *         description: Alumni already volunteered for this event.
 */
router.post('/placement-drives/:driveId/volunteer', requireAuth, requireRole('ALUMNI'), async (req, res, next) => {
  try {
    const profile = req.user.alumniProfile;
    if (!profile) return res.status(404).json({ success: false, message: 'Alumni profile was not found.' });
    const payload = parseInput(volunteerInput, req.body, res, 'Invalid volunteer request.');
    if (!payload) return;
    const drive = await prisma.placementDrive.findFirst({
      where: { id: req.params.driveId, isPublished: true, date: { gte: new Date() } },
      select: { id: true, title: true }
    });
    if (!drive) return res.status(404).json({ success: false, message: 'Upcoming placement event was not found.' });
    const volunteer = await prisma.driveVolunteer.create({
      data: { driveId: drive.id, alumniId: profile.id, note: payload.note || null }
    });
    return res.status(201).json({ success: true, data: volunteer, message: 'Your volunteer request was sent for review.' });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'You have already volunteered for this event.' });
    }
    return next(error);
  }
});

/**
 * @openapi
 * /mentorship-requests/{requestId}/messages:
 *   get:
 *     summary: Read an accepted mentorship conversation
 *     tags: [Mentorship]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Messages visible only to the student and alumni participants.
 *   post:
 *     summary: Send guidance in an accepted mentorship conversation
 *     tags: [Mentorship]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Message saved and participant notified.
 *       403:
 *         description: Caller is not a conversation participant.
 *       409:
 *         description: The mentorship request has not been accepted.
 */
router.get('/mentorship-requests/:requestId/messages', requireAuth, requireRole('STUDENT', 'ALUMNI'), async (req, res, next) => {
  try {
    const request = await prisma.mentorshipRequest.findUnique({
      where: { id: req.params.requestId },
      select: { id: true, status: true, studentId: true, alumniId: true }
    });
    if (!request) return res.status(404).json({ success: false, message: 'Mentorship request was not found.' });
    const isParticipant = req.user.role === 'STUDENT'
      ? request.studentId === req.user.studentProfile?.id
      : request.alumniId === req.user.alumniProfile?.id;
    if (!isParticipant) return res.status(403).json({ success: false, message: 'This mentorship conversation is not yours.' });
    if (request.status !== 'ACCEPTED') {
      return res.status(409).json({ success: false, message: 'Messaging is available after the mentorship request is accepted.' });
    }
    const messages = await prisma.mentorshipMessage.findMany({
      where: { mentorshipRequestId: request.id },
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            role: true,
            studentProfile: { select: { fullName: true } },
            alumniProfile: { select: { fullName: true } }
          }
        }
      },
      orderBy: { createdAt: 'asc' },
      take: 200
    });
    return res.json({ success: true, data: messages });
  } catch (error) {
    return next(error);
  }
});

router.post('/mentorship-requests/:requestId/messages', requireAuth, requireRole('STUDENT', 'ALUMNI'), async (req, res, next) => {
  try {
    const payload = parseInput(messageInput, req.body, res, 'Invalid mentorship message.');
    if (!payload) return;
    const request = await prisma.mentorshipRequest.findUnique({
      where: { id: req.params.requestId },
      select: {
        id: true,
        status: true,
        studentId: true,
        alumniId: true,
        student: { select: { userId: true } },
        alumni: { select: { userId: true, fullName: true } }
      }
    });
    if (!request) return res.status(404).json({ success: false, message: 'Mentorship request was not found.' });
    const isStudent = req.user.role === 'STUDENT' && request.studentId === req.user.studentProfile?.id;
    const isAlumni = req.user.role === 'ALUMNI' && request.alumniId === req.user.alumniProfile?.id;
    if (!isStudent && !isAlumni) return res.status(403).json({ success: false, message: 'This mentorship conversation is not yours.' });
    if (request.status !== 'ACCEPTED') {
      return res.status(409).json({ success: false, message: 'Messaging is available after the mentorship request is accepted.' });
    }
    const message = await prisma.$transaction(async (transaction) => {
      const created = await transaction.mentorshipMessage.create({
        data: { mentorshipRequestId: request.id, authorId: req.user.id, content: payload.content },
        select: { id: true, content: true, createdAt: true }
      });
      await transaction.notification.create({
        data: {
          userId: isStudent ? request.alumni.userId : request.student.userId,
          title: 'New mentorship message',
          message: `${isAlumni ? request.alumni.fullName : 'Your mentee'} sent a message in your mentorship conversation.`,
          link: '/mentorship-requests'
        }
      });
      return created;
    });
    return res.status(201).json({ success: true, data: { ...message, authorId: req.user.id } });
  } catch (error) {
    return next(error);
  }
});

/**
 * @openapi
 * /admin/alumni/review:
 *   get:
 *     summary: Load the Placement Officer alumni review queues
 *     tags: [Alumni administration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Alumni verification, resource, opportunity, and event-volunteer queues.
 *       403:
 *         description: Placement Officer role required.
 */
router.get('/admin/alumni/review', requireAuth, requireRole('PLACEMENT_OFFICER'), async (req, res, next) => {
  try {
    const [profiles, resources, recommendations, volunteers] = await Promise.all([
      prisma.alumniProfile.findMany({
        where: { isVerified: false },
        select: { id: true, fullName: true, department: true, graduationYear: true, currentCompany: true, jobTitle: true },
        orderBy: { createdAt: 'asc' },
        take: 100
      }),
      prisma.careerResource.findMany({
        where: { status: 'PENDING' },
        include: { alumni: { select: { fullName: true } } },
        orderBy: { createdAt: 'asc' },
        take: 100
      }),
      prisma.opportunityRecommendation.findMany({
        where: { status: 'PENDING' },
        include: { alumni: { select: { fullName: true } } },
        orderBy: { createdAt: 'asc' },
        take: 100
      }),
      prisma.driveVolunteer.findMany({
        where: { status: 'PENDING' },
        include: {
          alumni: { select: { fullName: true, currentCompany: true, jobTitle: true } },
          drive: { select: { title: true, date: true, location: true } }
        },
        orderBy: { createdAt: 'asc' },
        take: 100
      })
    ]);
    return res.json({ success: true, data: { profiles, resources, recommendations, volunteers } });
  } catch (error) {
    return next(error);
  }
});

router.patch('/admin/alumni/:alumniId/verify', requireAuth, requireRole('PLACEMENT_OFFICER'), async (req, res, next) => {
  try {
    const parsed = z.object({ verified: z.boolean() }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: 'Provide a verified boolean.' });
    const profile = await prisma.alumniProfile.findUnique({ where: { id: req.params.alumniId }, select: { id: true, userId: true, fullName: true } });
    if (!profile) return res.status(404).json({ success: false, message: 'Alumni profile was not found.' });
    const updated = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.alumniProfile.update({
        where: { id: profile.id },
        data: { isVerified: parsed.data.verified },
        select: { id: true, fullName: true, isVerified: true }
      });
      await transaction.notification.create({
        data: {
          userId: profile.userId,
          title: parsed.data.verified ? 'Alumni profile verified' : 'Alumni verification updated',
          message: parsed.data.verified
            ? 'The Placement Office verified your alumni profile.'
            : 'The Placement Office changed your alumni verification status.',
          link: '/alumni/dashboard'
        }
      });
      return saved;
    });
    return res.json({ success: true, data: updated });
  } catch (error) {
    return next(error);
  }
});

router.patch('/admin/alumni/resources/:resourceId/review', requireAuth, requireRole('PLACEMENT_OFFICER'), async (req, res, next) => {
  try {
    const payload = parseInput(reviewInput, req.body, res, 'Invalid resource review.');
    if (!payload) return;
    const existing = await prisma.careerResource.findUnique({ where: { id: req.params.resourceId } });
    if (!existing) return res.status(404).json({ success: false, message: 'Career resource was not found.' });
    if (existing.status !== 'PENDING') return res.status(409).json({ success: false, message: 'This resource has already been reviewed.' });
    const updated = await prisma.$transaction(async (transaction) => {
      const resource = await transaction.careerResource.update({
        where: { id: existing.id },
        data: { status: payload.status, reviewerId: req.user.id, reviewedAt: new Date() }
      });
      await transaction.notification.create({
        data: {
          userId: (await transaction.alumniProfile.findUnique({ where: { id: existing.alumniId }, select: { userId: true } })).userId,
          title: `Career resource ${payload.status.toLowerCase()}`,
          message: `Your resource "${existing.title}" was ${payload.status.toLowerCase()} by the Placement Office.`,
          link: '/alumni/dashboard'
        }
      });
      return resource;
    });
    return res.json({ success: true, data: updated });
  } catch (error) {
    return next(error);
  }
});

router.patch('/admin/alumni/opportunities/:recommendationId/review', requireAuth, requireRole('PLACEMENT_OFFICER'), async (req, res, next) => {
  try {
    const payload = parseInput(reviewInput, req.body, res, 'Invalid opportunity review.');
    if (!payload) return;
    const existing = await prisma.opportunityRecommendation.findUnique({ where: { id: req.params.recommendationId } });
    if (!existing) return res.status(404).json({ success: false, message: 'Opportunity recommendation was not found.' });
    if (existing.status !== 'PENDING') return res.status(409).json({ success: false, message: 'This recommendation has already been reviewed.' });
    const updated = await prisma.$transaction(async (transaction) => {
      const recommendation = await transaction.opportunityRecommendation.update({
        where: { id: existing.id },
        data: { status: payload.status, reviewerId: req.user.id, reviewedAt: new Date() }
      });
      const alumni = await transaction.alumniProfile.findUnique({ where: { id: existing.alumniId }, select: { userId: true } });
      await transaction.notification.create({
        data: {
          userId: alumni.userId,
          title: `Opportunity recommendation ${payload.status.toLowerCase()}`,
          message: `Your recommendation "${existing.title}" was ${payload.status.toLowerCase()} by the Placement Office.`,
          link: '/alumni/dashboard'
        }
      });
      return recommendation;
    });
    return res.json({ success: true, data: updated });
  } catch (error) {
    return next(error);
  }
});

router.patch('/admin/alumni/volunteers/:volunteerId/review', requireAuth, requireRole('PLACEMENT_OFFICER'), async (req, res, next) => {
  try {
    const payload = parseInput(reviewInput, req.body, res, 'Invalid event volunteer review.');
    if (!payload) return;
    const existing = await prisma.driveVolunteer.findUnique({
      where: { id: req.params.volunteerId },
      include: { alumni: { select: { userId: true } }, drive: { select: { title: true } } }
    });
    if (!existing) return res.status(404).json({ success: false, message: 'Event volunteer request was not found.' });
    if (existing.status !== 'PENDING') return res.status(409).json({ success: false, message: 'This volunteer request has already been reviewed.' });
    const updated = await prisma.$transaction(async (transaction) => {
      const volunteer = await transaction.driveVolunteer.update({
        where: { id: existing.id },
        data: { status: payload.status }
      });
      await transaction.notification.create({
        data: {
          userId: existing.alumni.userId,
          title: `Event volunteer request ${payload.status.toLowerCase()}`,
          message: `Your request to volunteer at "${existing.drive.title}" was ${payload.status.toLowerCase()}.`,
          link: '/alumni/dashboard'
        }
      });
      return volunteer;
    });
    return res.json({ success: true, data: updated });
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
