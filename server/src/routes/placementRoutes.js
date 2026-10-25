import express from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
const officersOnly = [requireAuth, requireRole('PLACEMENT_OFFICER')];

const analyticsFilters = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  graduationYear: z.coerce.number().int().min(1980).max(2200).optional(),
  department: z.string().trim().min(1).max(100).optional()
}).refine((filters) => !filters.from || !filters.to || new Date(filters.from) <= new Date(filters.to), {
  message: 'The start date must be before the end date.',
  path: ['from']
});

const announcementInput = z.object({
  title: z.string().trim().min(3).max(160),
  message: z.string().trim().min(5).max(10000),
  type: z.enum(['GENERAL', 'PLACEMENT', 'EVENT', 'URGENT']).default('GENERAL'),
  isPublished: z.boolean().optional()
});

const driveInput = z.object({
  title: z.string().trim().min(3).max(160),
  companyId: z.string().cuid().nullable().optional(),
  date: z.string().datetime(),
  location: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5000).nullable().optional(),
  isPublished: z.boolean().optional()
});

function parseFilters(query, res) {
  const result = analyticsFilters.safeParse(query);
  if (!result.success) {
    res.status(400).json({ success: false, message: 'Invalid analytics filters.', issues: result.error.issues });
    return null;
  }
  return result.data;
}

function applicationWhere(filters) {
  return {
    ...((filters.from || filters.to) && {
      appliedAt: {
        ...(filters.from && { gte: new Date(filters.from) }),
        ...(filters.to && { lte: new Date(filters.to) })
      }
    }),
    ...((filters.graduationYear || filters.department) && {
      student: {
        ...(filters.graduationYear && { graduationYear: filters.graduationYear }),
        ...(filters.department && { branch: { equals: filters.department, mode: 'insensitive' } })
      }
    })
  };
}

function csvCell(value) {
  let text = value == null ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

async function notifyStudents(transaction, { title, message }) {
  const students = await transaction.user.findMany({
    where: { role: 'STUDENT', isApproved: true },
    select: { id: true }
  });
  if (!students.length) return;
  await transaction.notification.createMany({
    data: students.map(({ id }) => ({
      userId: id,
      title,
      message,
      link: '/dashboard'
    }))
  });
}

/**
 * @openapi
 * /analytics/overview:
 *   get:
 *     summary: Get live placement metrics
 *     tags: [Placement analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: graduationYear
 *         schema: { type: integer }
 *       - in: query
 *         name: department
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Counts and placement-rate definitions.
 *       403:
 *         description: Placement Officer role required.
 */
router.get('/analytics/overview', ...officersOnly, async (req, res, next) => {
  try {
    const filters = parseFilters(req.query, res);
    if (!filters) return;
    const applicationsWhere = applicationWhere(filters);
    const studentWhere = {
      ...(filters.graduationYear && { graduationYear: filters.graduationYear }),
      ...(filters.department && { branch: { equals: filters.department, mode: 'insensitive' } })
    };
    const [students, alumni, recruiters, publishedJobs, applications, shortlisted, selectedApplications, placedStudents] = await Promise.all([
      prisma.studentProfile.count({ where: studentWhere }),
      prisma.alumniProfile.count(),
      prisma.user.count({ where: { role: 'RECRUITER', isApproved: true } }),
      prisma.job.count({
        where: {
          isPublished: true,
          isArchived: false,
          ...((filters.from || filters.to) && {
            createdAt: {
              ...(filters.from && { gte: new Date(filters.from) }),
              ...(filters.to && { lte: new Date(filters.to) })
            }
          })
        }
      }),
      prisma.application.count({ where: applicationsWhere }),
      prisma.application.count({
        where: { ...applicationsWhere, status: { in: ['SHORTLISTED', 'INTERVIEW_SCHEDULED'] } }
      }),
      prisma.application.count({ where: { ...applicationsWhere, status: 'SELECTED' } }),
      prisma.application.findMany({
        where: { ...applicationsWhere, status: 'SELECTED' },
        distinct: ['studentId'],
        select: { studentId: true }
      })
    ]);
    return res.json({
      success: true,
      data: {
        students,
        alumni,
        approvedRecruiters: recruiters,
        publishedJobs,
        applications,
        shortlisted,
        selectedApplications,
        placedStudents: placedStudents.length,
        placementRate: students ? Number(((placedStudents.length / students) * 100).toFixed(1)) : 0,
        definitions: {
          shortlisted: 'Applications in SHORTLISTED or INTERVIEW_SCHEDULED status.',
          selectedApplications: 'Applications in SELECTED status; a student may have more than one.',
          placedStudents: 'Distinct students with a SELECTED application.',
          placementRate: 'Distinct placed students divided by the filtered student population.'
        }
      }
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * @openapi
 * /analytics/placements:
 *   get:
 *     summary: Get selected placement breakdowns
 *     tags: [Placement analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Selected distinct students by department, graduation year and company.
 */
router.get('/analytics/placements', ...officersOnly, async (req, res, next) => {
  try {
    const filters = parseFilters(req.query, res);
    if (!filters) return;
    const selected = await prisma.application.findMany({
      where: { ...applicationWhere(filters), status: 'SELECTED' },
      orderBy: [{ appliedAt: 'asc' }, { id: 'asc' }],
      select: {
        studentId: true,
        student: { select: { branch: true, graduationYear: true } },
        job: { select: { company: { select: { name: true } } } }
      }
    });

    const byDepartment = new Map();
    const byGraduationYear = new Map();
    const byCompany = new Map();
    const countedStudents = new Set();
    for (const application of selected) {
      if (countedStudents.has(application.studentId)) continue;
      countedStudents.add(application.studentId);
      const department = application.student.branch || 'Not specified';
      const year = application.student.graduationYear ?? 'Not specified';
      const company = application.job.company.name;
      byDepartment.set(department, (byDepartment.get(department) || 0) + 1);
      byGraduationYear.set(year, (byGraduationYear.get(year) || 0) + 1);
      byCompany.set(company, (byCompany.get(company) || 0) + 1);
    }

    return res.json({
      success: true,
      data: {
        byDepartment: [...byDepartment].map(([name, placements]) => ({ name, placements })),
        byGraduationYear: [...byGraduationYear]
          .map(([year, placements]) => ({ year: String(year), placements }))
          .sort((a, b) => a.year.localeCompare(b.year)),
        byCompany: [...byCompany].map(([name, placements]) => ({ name, placements })),
        metric: 'One selected student is counted once per report, grouped by their department, graduation year, and the company of their first selected application.'
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/analytics/export.csv', ...officersOnly, async (req, res, next) => {
  try {
    const filters = parseFilters(req.query, res);
    if (!filters) return;
    const placements = await prisma.application.findMany({
      where: { ...applicationWhere(filters), status: 'SELECTED' },
      distinct: ['studentId'],
      orderBy: { appliedAt: 'asc' },
      select: {
        appliedAt: true,
        student: {
          select: {
            fullName: true,
            branch: true,
            graduationYear: true
          }
        },
        job: {
          select: {
            title: true,
            company: { select: { name: true } }
          }
        }
      },
      orderBy: { appliedAt: 'asc' }
    });
    const rows = [
      ['Student', 'Department', 'Graduation year', 'Company', 'Job title', 'Selected application date'],
      ...placements.map((application) => [
        application.student.fullName,
        application.student.branch,
        application.student.graduationYear,
        application.job.company.name,
        application.job.title,
        application.appliedAt.toISOString()
      ])
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
    res.type('text/csv');
    res.attachment('campusconnect-placement-report.csv');
    return res.send(csv);
  } catch (error) {
    return next(error);
  }
});

/**
 * @openapi
 * /announcements:
 *   get:
 *     summary: List published placement announcements
 *     tags: [Placement]
 *     responses:
 *       200:
 *         description: Public announcements.
 *   post:
 *     summary: Publish an announcement
 *     tags: [Placement]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Announcement created.
 *       403:
 *         description: Placement Officer role required.
 */
router.get('/announcements', async (req, res, next) => {
  try {
    const announcements = await prisma.announcement.findMany({
      where: { isPublished: true },
      select: { id: true, title: true, message: true, type: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    return res.json({ success: true, data: announcements });
  } catch (error) {
    return next(error);
  }
});

/**
 * @openapi
 * /announcements/manage:
 *   get:
 *     summary: List published and unpublished announcements for management
 *     tags: [Placement]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Announcements available to Placement Officers.
 *       403:
 *         description: Placement Officer role required.
 */
router.get('/announcements/manage', ...officersOnly, async (req, res, next) => {
  try {
    const announcements = await prisma.announcement.findMany({
      select: { id: true, title: true, message: true, type: true, isPublished: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    return res.json({ success: true, data: announcements });
  } catch (error) {
    return next(error);
  }
});

router.post('/announcements', ...officersOnly, async (req, res, next) => {
  try {
    const parsed = announcementInput.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'Invalid announcement.', issues: parsed.error.issues });
    }
    const announcement = await prisma.$transaction(async (transaction) => {
      const created = await transaction.announcement.create({
        data: {
          ...parsed.data,
          isPublished: parsed.data.isPublished ?? true,
          authorId: req.user.id
        }
      });
      if (created.isPublished) {
        await notifyStudents(transaction, {
          title: 'New placement announcement',
          message: created.title
        });
      }
      return created;
    });
    return res.status(201).json({ success: true, data: announcement });
  } catch (error) {
    return next(error);
  }
});

router.patch('/announcements/:announcementId', ...officersOnly, async (req, res, next) => {
  try {
    const parsed = announcementInput.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'Invalid announcement update.', issues: parsed.error.issues });
    }
    const existing = await prisma.announcement.findUnique({ where: { id: req.params.announcementId } });
    if (!existing) return res.status(404).json({ success: false, message: 'Announcement was not found.' });
    const announcement = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.announcement.update({
        where: { id: existing.id },
        data: parsed.data
      });
      if (existing.isPublished === false && updated.isPublished) {
        await notifyStudents(transaction, {
          title: 'New placement announcement',
          message: updated.title
        });
      }
      return updated;
    });
    return res.json({ success: true, data: announcement });
  } catch (error) {
    return next(error);
  }
});

router.delete('/announcements/:announcementId', ...officersOnly, async (req, res, next) => {
  try {
    const existing = await prisma.announcement.findUnique({ where: { id: req.params.announcementId } });
    if (!existing) return res.status(404).json({ success: false, message: 'Announcement was not found.' });
    const announcement = await prisma.announcement.update({
      where: { id: existing.id },
      data: { isPublished: false }
    });
    return res.json({ success: true, message: 'Announcement archived.', data: announcement });
  } catch (error) {
    return next(error);
  }
});

/**
 * @openapi
 * /placement-drives:
 *   get:
 *     summary: List upcoming published placement drives
 *     tags: [Placement]
 *     responses:
 *       200:
 *         description: Upcoming drives and public company details.
 *   post:
 *     summary: Schedule a placement drive
 *     tags: [Placement]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Drive created.
 */
router.get('/placement-drives', async (req, res, next) => {
  try {
    const drives = await prisma.placementDrive.findMany({
      where: { isPublished: true, date: { gte: new Date() } },
      include: { company: { select: { id: true, name: true } } },
      orderBy: { date: 'asc' },
      take: 50
    });
    return res.json({ success: true, data: drives });
  } catch (error) {
    return next(error);
  }
});

/**
 * @openapi
 * /placement-drives/manage:
 *   get:
 *     summary: List placement drives for administration
 *     tags: [Placement]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Published and unpublished placement drives.
 *       403:
 *         description: Placement Officer role required.
 */
router.get('/placement-drives/manage', ...officersOnly, async (req, res, next) => {
  try {
    const drives = await prisma.placementDrive.findMany({
      include: { company: { select: { id: true, name: true } } },
      orderBy: { date: 'asc' },
      take: 100
    });
    return res.json({ success: true, data: drives });
  } catch (error) {
    return next(error);
  }
});

router.post('/placement-drives', ...officersOnly, async (req, res, next) => {
  try {
    const parsed = driveInput.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'Invalid placement drive.', issues: parsed.error.issues });
    }
    if (new Date(parsed.data.date) <= new Date()) {
      return res.status(400).json({ success: false, message: 'The placement drive must be scheduled in the future.' });
    }
    const { date, isPublished, ...driveData } = parsed.data;
    const drive = await prisma.$transaction(async (transaction) => {
      const created = await transaction.placementDrive.create({
        data: {
          ...driveData,
          date: new Date(date),
          isPublished: isPublished ?? true
        }
      });
      if (created.isPublished) {
        await notifyStudents(transaction, {
          title: 'New placement drive',
          message: `${created.title} is scheduled for ${new Date(created.date).toLocaleString()}.`
        });
      }
      return created;
    });
    return res.status(201).json({ success: true, data: drive });
  } catch (error) {
    return next(error);
  }
});

router.patch('/placement-drives/:driveId', ...officersOnly, async (req, res, next) => {
  try {
    const parsed = driveInput.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'Invalid placement drive update.', issues: parsed.error.issues });
    }
    if (parsed.data.date && new Date(parsed.data.date) <= new Date()) {
      return res.status(400).json({ success: false, message: 'The placement drive must be scheduled in the future.' });
    }
    const existing = await prisma.placementDrive.findUnique({ where: { id: req.params.driveId } });
    if (!existing) return res.status(404).json({ success: false, message: 'Placement drive was not found.' });
    const { date, ...driveData } = parsed.data;
    const drive = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.placementDrive.update({
        where: { id: existing.id },
        data: { ...driveData, ...(date && { date: new Date(date) }) }
      });
      if (existing.isPublished === false && updated.isPublished) {
        await notifyStudents(transaction, {
          title: 'New placement drive',
          message: `${updated.title} is scheduled for ${new Date(updated.date).toLocaleString()}.`
        });
      }
      return updated;
    });
    return res.json({ success: true, data: drive });
  } catch (error) {
    return next(error);
  }
});

router.delete('/placement-drives/:driveId', ...officersOnly, async (req, res, next) => {
  try {
    const existing = await prisma.placementDrive.findUnique({ where: { id: req.params.driveId } });
    if (!existing) return res.status(404).json({ success: false, message: 'Placement drive was not found.' });
    const drive = await prisma.placementDrive.update({
      where: { id: existing.id },
      data: { isPublished: false }
    });
    return res.json({ success: true, message: 'Placement drive archived.', data: drive });
  } catch (error) {
    return next(error);
  }
});

/**
 * @openapi
 * /notifications:
 *   get:
 *     summary: List the signed-in user's notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User-scoped notifications.
 */
router.get('/notifications', requireAuth, async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    return res.json({ success: true, data: notifications });
  } catch (error) {
    return next(error);
  }
});

router.patch('/notifications/:notificationId/read', requireAuth, async (req, res, next) => {
  try {
    const notification = await prisma.notification.findFirst({
      where: { id: req.params.notificationId, userId: req.user.id }
    });
    if (!notification) return res.status(404).json({ success: false, message: 'Notification was not found.' });
    const updated = await prisma.notification.update({
      where: { id: notification.id },
      data: { isRead: true }
    });
    return res.json({ success: true, data: updated });
  } catch (error) {
    return next(error);
  }
});

export default router;
