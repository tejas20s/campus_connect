import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';

vi.mock('../src/db/prisma.js', () => ({
  prisma: {
    revokedToken: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    studentProfile: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    application: { findFirst: vi.fn() }
  }
}));

import app from '../src/app.js';
import { prisma } from '../src/db/prisma.js';
import { env } from '../src/config/env.js';

describe('student profile and resume API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function tokenFor(user) {
    prisma.user.findUnique.mockResolvedValue(user);
    return jwt.sign({ sub: user.id }, env.jwtSecret, { expiresIn: '1h' });
  }

  it('returns only the authenticated student profile', async () => {
    const profile = {
      id: 'student-profile-1',
      fullName: 'Demo Student',
      branch: 'Computer Science',
      graduationYear: 2027,
      cgpa: 8.2,
      phone: '555-0100',
      skills: ['JavaScript'],
      portfolioLinks: { portfolio: 'https://example.com' },
      certifications: [{ name: 'Cloud Basics', issuer: 'Example', issuedAt: '2025', url: '' }],
      projects: [{ name: 'Portfolio', technologies: ['React'], url: 'https://example.com' }],
      resumeUrl: 'private-resume-id',
      profileImageUrl: null
    };
    const token = tokenFor({
      id: 'student-1',
      email: 'student@example.com',
      role: 'STUDENT',
      studentProfile: profile,
      recruiterProfile: null,
      alumniProfile: null
    });

    const response = await request(app)
      .get('/api/v1/students/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.email).toBe('student@example.com');
    expect(response.body.data.hasResume).toBe(true);
    expect(response.body.data.resumeUrl).toBeUndefined();
    expect(response.body.data.phone).toBe('555-0100');
  });

  it('validates student profile changes before updating the database', async () => {
    const token = tokenFor({
      id: 'student-1',
      email: 'student@example.com',
      role: 'STUDENT',
      studentProfile: { id: 'student-profile-1' },
      recruiterProfile: null,
      alumniProfile: null
    });

    const response = await request(app)
      .patch('/api/v1/students/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ cgpa: 14 });

    expect(response.status).toBe(400);
    expect(prisma.studentProfile.update).not.toHaveBeenCalled();
  });

  it('accepts validated certification and project profile updates', async () => {
    const token = tokenFor({
      id: 'student-1',
      email: 'student@example.com',
      role: 'STUDENT',
      studentProfile: { id: 'student-profile-1' },
      recruiterProfile: null,
      alumniProfile: null
    });
    prisma.studentProfile.update.mockResolvedValue({
      id: 'student-profile-1',
      fullName: 'Student User',
      skills: [],
      certifications: [{ name: 'Cloud Basics', issuer: 'Example' }],
      projects: [{ name: 'Portfolio', technologies: ['React'] }],
      resumeUrl: null,
      profileImageUrl: null
    });

    const response = await request(app)
      .patch('/api/v1/students/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        certifications: [{ name: 'Cloud Basics', issuer: 'Example' }],
        projects: [{ name: 'Portfolio', technologies: ['React'] }]
      });

    expect(response.status).toBe(200);
    expect(response.body.data.certifications).toHaveLength(1);
    expect(response.body.data.projects).toHaveLength(1);
    expect(prisma.studentProfile.update.mock.calls[0][0].data.projects[0].name).toBe('Portfolio');
  });
  it('rejects a file with a PDF extension but non-PDF contents', async () => {
    const token = tokenFor({
      id: 'student-1',
      email: 'student@example.com',
      role: 'STUDENT',
      studentProfile: { id: 'student-profile-1' },
      recruiterProfile: null,
      alumniProfile: null
    });

    const response = await request(app)
      .post('/api/v1/students/me/resume')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('not a pdf'), {
        filename: 'resume.pdf',
        contentType: 'application/pdf'
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/valid PDF/i);
    expect(prisma.studentProfile.update).not.toHaveBeenCalled();
  });

  it('does not allow recruiter access to a student resume without an application match', async () => {
    const token = tokenFor({
      id: 'recruiter-1',
      email: 'recruiter@example.com',
      role: 'RECRUITER',
      isApproved: true,
      studentProfile: null,
      recruiterProfile: { companyId: 'company-1' },
      alumniProfile: null
    });
    prisma.studentProfile.findUnique.mockResolvedValue({
      id: 'student-profile-2',
      resumeUrl: 'private-resume-id'
    });
    prisma.application.findFirst.mockResolvedValue(null);

    const response = await request(app)
      .get('/api/v1/students/student-profile-2/resume')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.data).toBeUndefined();
  });
});
