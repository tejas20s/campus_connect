import express from 'express';
import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';
import { emailLayout, sendEmail } from '../services/email.js';

const router = express.Router();
const authenticationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts. Please try again later.' }
});

const registerSchema = z.object({
  email: z.string().email('A valid email is required.'),
  password: z.string().min(8, 'Password must be at least 8 characters long.'),
  fullName: z.string().min(2, 'Full name is required.'),
  role: z.enum(['STUDENT', 'ALUMNI', 'RECRUITER', 'PLACEMENT_OFFICER']).optional()
});

const loginSchema = z.object({
  email: z.string().email('A valid email is required.'),
  password: z.string().min(8, 'Password must be at least 8 characters long.')
});

function issueToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

router.post('/register', authenticationLimiter, async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid registration payload.',
        issues: parsed.error.issues
      });
    }

    const payload = parsed.data;
    const normalizedEmail = payload.email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with that email already exists.'
      });
    }

    if (payload.role && !['STUDENT', 'ALUMNI', 'RECRUITER'].includes(payload.role)) {
      return res.status(403).json({
        success: false,
        message: 'Public registration is restricted to Student, Alumni, and Recruiter accounts. Placement Officer accounts require administrator provisioning.'
      });
    }

    const role = payload.role || 'STUDENT';
    const isApproved = role !== 'RECRUITER';
    const passwordHash = await bcrypt.hash(payload.password, 10);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        role,
        isApproved,
        ...(role === 'RECRUITER' ? {
          recruiterProfile: {
            create: {
              approvalStatus: 'PENDING'
            }
          }
        } : {}),
        ...(role === 'STUDENT' ? {
          studentProfile: {
            create: {
              fullName: payload.fullName,
              branch: 'General',
              graduationYear: new Date().getFullYear() + 4
            }
          }
        } : {}),
        ...(role === 'ALUMNI' ? {
          alumniProfile: {
            create: {
              fullName: payload.fullName,
              department: 'General',
              isPublic: true
            }
          }
        } : {})
      }
    });

    await sendEmail({
      to: user.email,
      subject: 'Welcome to CampusConnect',
      html: emailLayout('Welcome to CampusConnect', 'Your account is ready. Sign in to complete your profile and explore the portal.')
    });
    const token = issueToken(user);

    return res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isApproved: user.isApproved
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/login', authenticationLimiter, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid login payload.',
        issues: parsed.error.issues
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email.trim().toLowerCase() }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const passwordMatches = await bcrypt.compare(parsed.data.password, user.passwordHash);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    if (user.role === 'RECRUITER' && !user.isApproved) {
      return res.status(403).json({
        success: false,
        message: 'Your recruiter account is pending administrator approval.'
      });
    }

    const token = issueToken(user);

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isApproved: user.isApproved
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/refresh', requireAuth, (req, res) => {
  const token = issueToken(req.user);

  return res.json({
    success: true,
    token,
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      isApproved: req.user.isApproved
    }
  });
});

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Revoke the current access token
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Session token revoked.
 *       401:
 *         description: Missing, invalid, expired, or previously revoked token.
 */
router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const expiresAt = req.authToken?.payload?.exp;
    if (!expiresAt) {
      return res.status(401).json({ success: false, message: 'The session token has no valid expiration.' });
    }
    const tokenHash = createHash('sha256').update(req.authToken.token).digest('hex');
    await prisma.revokedToken.upsert({
      where: { tokenHash },
      create: { tokenHash, expiresAt: new Date(expiresAt * 1000) },
      update: { expiresAt: new Date(expiresAt * 1000) }
    });
    await prisma.revokedToken.deleteMany({ where: { expiresAt: { lte: new Date() } } });
    return res.json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', requireAuth, async (req, res) => {
  return res.json({
    success: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      isApproved: req.user.isApproved,
      profile: req.user.studentProfile || req.user.recruiterProfile || req.user.alumniProfile || null
    }
  });
});

export default router;
