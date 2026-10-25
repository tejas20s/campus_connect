import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';

export async function requireAuth(req, res, next) {
  const authorizationHeader = req.headers.authorization;
  const token = authorizationHeader?.startsWith('Bearer ')
    ? authorizationHeader.replace('Bearer ', '').trim()
    : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token.'
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        isApproved: true,
        studentProfile: true,
        recruiterProfile: true,
        alumniProfile: true
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found.'
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action.'
      });
    }

    return next();
  };
}

export function requireApprovedRecruiter(req, res, next) {
  if (req.user.role !== 'RECRUITER') {
    return res.status(403).json({
      success: false,
      message: 'Only approved recruiters may access this resource.'
    });
  }

  if (!req.user.isApproved) {
    return res.status(403).json({
      success: false,
      message: 'Recruiter account is pending approval.'
    });
  }

  return next();
}
