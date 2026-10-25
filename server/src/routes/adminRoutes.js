import express from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { writeAuditLog } from '../services/audit.js';

const router = express.Router();

const approvalSchema = z.object({
  approved: z.boolean(),
  reason: z.string().min(1).max(500).optional()
});

const studentsQuery = z.object({
  q: z.string().trim().max(120).optional(),
  graduationYear: z.coerce.number().int().min(1980).max(2200).optional(),
  branch: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20)
});

/**
 * @openapi
 * /admin/students:
 *   get:
 *     summary: Search the student registry
 *     tags: [Administration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: graduationYear
 *         schema: { type: integer }
 *       - in: query
 *         name: branch
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, minimum: 1, maximum: 50 }
 *     responses:
 *       200:
 *         description: Paginated student records without private contact or file data.
 *       403:
 *         description: Placement Officer role required.
 */
router.get('/students', requireAuth, requireRole('PLACEMENT_OFFICER'), async (req, res, next) => {
  try {
    const parsed = studentsQuery.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'Invalid student filters.', issues: parsed.error.issues });
    }

    const { q, graduationYear, branch, page, pageSize } = parsed.data;
    const where = {
      ...(graduationYear && { graduationYear }),
      ...(branch && { branch: { contains: branch, mode: 'insensitive' } }),
      ...(q && {
        OR: [
          { fullName: { contains: q, mode: 'insensitive' } },
          { branch: { contains: q, mode: 'insensitive' } },
          { user: { email: { contains: q, mode: 'insensitive' } } }
        ]
      })
    };
    const [students, total] = await Promise.all([
      prisma.studentProfile.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          branch: true,
          graduationYear: true,
          cgpa: true,
          skills: true,
          user: { select: { email: true } },
          _count: { select: { applications: true } }
        },
        orderBy: { fullName: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.studentProfile.count({ where })
    ]);

    return res.json({
      success: true,
      data: students,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/recruiters/pending', requireAuth, requireRole('PLACEMENT_OFFICER'), async (req, res, next) => {
  try {
    const recruiters = await prisma.user.findMany({
      where: {
        role: 'RECRUITER',
        isApproved: false,
        recruiterProfile: { is: { approvalStatus: 'PENDING' } }
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
        recruiterProfile: {
          select: {
            designation: true,
            approvalStatus: true,
            company: { select: { id: true, name: true } }
          }
        }
      }
    });

    return res.json({
      success: true,
      data: recruiters
    });
  } catch (error) {
    return next(error);
  }
});

router.patch('/recruiters/:recruiterId/approval', requireAuth, requireRole('PLACEMENT_OFFICER'), async (req, res, next) => {
  try {
    const parsed = approvalSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid approval payload.',
        issues: parsed.error.issues
      });
    }

    const recruiterId = req.params.recruiterId;
    const recruiter = await prisma.user.findUnique({
      where: { id: recruiterId },
      include: { recruiterProfile: true }
    });

    if (!recruiter || recruiter.role !== 'RECRUITER') {
      return res.status(404).json({
        success: false,
        message: 'Recruiter was not found.'
      });
    }

    const updatedUser = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.user.update({
        where: { id: recruiterId },
        data: {
          isApproved: parsed.data.approved,
          role: 'RECRUITER',
          recruiterProfile: {
            update: {
              approvalStatus: parsed.data.approved ? 'APPROVED' : 'REJECTED'
            }
          }
        },
        select: {
          id: true,
          email: true,
          role: true,
          isApproved: true,
          recruiterProfile: {
            select: {
              companyId: true,
              designation: true,
              approvalStatus: true
            }
          }
        }
      });
      await writeAuditLog(transaction, {
        actorId: req.user.id,
        action: parsed.data.approved ? 'RECRUITER_APPROVED' : 'RECRUITER_REJECTED',
        resourceType: 'User',
        resourceId: recruiterId,
        details: { approvalStatus: parsed.data.approved ? 'APPROVED' : 'REJECTED' }
      });
      return updated;
    });

    return res.json({
      success: true,
      message: parsed.data.approved ? 'Recruiter approved successfully.' : 'Recruiter rejected.',
      data: updatedUser
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
