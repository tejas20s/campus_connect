import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/db/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    revokedToken: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn()
    },
    company: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    studentProfile: {
      findMany: vi.fn(),
      count: vi.fn()
    },
    job: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    application: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    applicationStatusEvent: { create: vi.fn() },
    interview: { upsert: vi.fn() },
    notification: { create: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn()
  }
}));

import app from '../src/app.js';
import { prisma } from '../src/db/prisma.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { env } from '../src/config/env.js';

describe('CampusConnect auth API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns a health response from the API root', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.service).toBe('CampusConnect API');
  });

  it('revokes the signed-in token on logout', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'student-1',
      email: 'student@example.com',
      role: 'STUDENT',
      isApproved: true,
      studentProfile: null,
      recruiterProfile: null,
      alumniProfile: null
    });
    prisma.revokedToken.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ tokenHash: 'revoked-hash' });
    prisma.revokedToken.upsert.mockResolvedValue({});
    prisma.revokedToken.deleteMany.mockResolvedValue({ count: 0 });
    const token = jwt.sign({ sub: 'student-1' }, env.jwtSecret, { expiresIn: '1h' });

    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    const afterLogout = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(logout.status).toBe(200);
    expect(prisma.revokedToken.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { tokenHash: expect.any(String) },
      create: expect.objectContaining({ expiresAt: expect.any(Date) })
    }));
    expect(prisma.revokedToken.upsert.mock.calls[0][0].where.tokenHash).not.toBe(token);
    expect(afterLogout.status).toBe(401);
  });

  it('publishes the documented API endpoints', async () => {
    const response = await request(app).get('/api-docs.json');

    expect(response.status).toBe(200);
    expect(response.body.paths['/analytics/overview']).toBeDefined();
    expect(response.body.paths['/alumni']).toBeDefined();
    expect(response.body.paths['/placement-drives/manage']).toBeDefined();
    expect(response.body.paths['/students/me/resume']).toBeDefined();
    expect(response.body.paths['/students/me/profile-image']).toBeDefined();
    expect(response.body.paths['/admin/students']).toBeDefined();
    expect(response.body.paths['/alumni/dashboard']).toBeDefined();
    expect(response.body.paths['/career-resources']).toBeDefined();
    expect(response.body.paths['/mentorship-requests/{requestId}/messages']).toBeDefined();
    expect(response.body.paths['/applications/my']).toBeDefined();
    expect(response.body.paths['/applications/{applicationId}/status']).toBeDefined();
    expect(response.body.paths['/companies/mine']).toBeDefined();
    expect(response.body.paths['/announcements/manage']).toBeDefined();
    expect(response.body.paths['/jobs'].get.parameters.some((parameter) => parameter.name === 'eligibleOnly')).toBe(true);
    expect(response.body.paths['/auth/logout']).toBeDefined();
  });

  it('allows Placement Officers to search students without exposing private fields', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'officer-1',
      email: 'officer@example.com',
      role: 'PLACEMENT_OFFICER',
      isApproved: true,
      studentProfile: null,
      recruiterProfile: null,
      alumniProfile: null
    });
    prisma.studentProfile.findMany.mockResolvedValue([{
      id: 'student-profile-1',
      fullName: 'Demo Student',
      branch: 'Computer Science',
      graduationYear: 2027,
      cgpa: 8.4,
      skills: ['JavaScript'],
      user: { email: 'student@example.com' },
      _count: { applications: 2 }
    }]);
    prisma.studentProfile.count.mockResolvedValue(1);
    const token = jwt.sign({ sub: 'officer-1' }, env.jwtSecret, { expiresIn: '1h' });

    const response = await request(app)
      .get('/api/v1/admin/students?q=demo&page=1')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.pagination.total).toBe(1);
    expect(response.body.data[0].user.email).toBe('student@example.com');
    expect(response.body.data[0].phone).toBeUndefined();
    expect(response.body.data[0].resumeUrl).toBeUndefined();
    expect(prisma.studentProfile.findMany.mock.calls[0][0].select.user.select.passwordHash).toBeUndefined();
  });

  it('denies student-registry access to non-officers', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'student-1',
      email: 'student@example.com',
      role: 'STUDENT',
      isApproved: true,
      studentProfile: { id: 'student-profile-1' },
      recruiterProfile: null,
      alumniProfile: null
    });
    const token = jwt.sign({ sub: 'student-1' }, env.jwtSecret, { expiresIn: '1h' });

    const response = await request(app)
      .get('/api/v1/admin/students')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(prisma.studentProfile.findMany).not.toHaveBeenCalled();
  });

  it('rejects invalid registration data before hitting the database layer', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'not-an-email',
        password: 'short',
        fullName: 'Test User'
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('rejects privileged public registrations', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Placement Admin',
        email: 'admin@example.com',
        password: 'supersecret',
        role: 'PLACEMENT_OFFICER'
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/restricted/i);
  });

  it('authenticates valid users and blocks invalid credentials or pending recruiters', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: 'student-1',
        email: 'student@example.com',
        passwordHash,
        role: 'STUDENT',
        isApproved: true
      })
      .mockResolvedValueOnce({
        id: 'recruiter-1',
        email: 'recruiter@example.com',
        passwordHash,
        role: 'RECRUITER',
        isApproved: false
      })
      .mockResolvedValueOnce({
        id: 'student-1',
        email: 'student@example.com',
        passwordHash,
        role: 'STUDENT',
        isApproved: true
      });

    const validLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'STUDENT@example.com', password: 'correct-password' });
    expect(validLogin.status).toBe(200);
    expect(validLogin.body.token).toBeTruthy();
    expect(validLogin.body.user.role).toBe('STUDENT');

    const pendingRecruiterLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'recruiter@example.com', password: 'correct-password' });
    expect(pendingRecruiterLogin.status).toBe(403);

    const invalidPasswordLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'student@example.com', password: 'wrong-password' });
    expect(invalidPasswordLogin.status).toBe(401);
  });

  it('registers recruiters as pending approval instead of granting access', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'recruiter-1',
      email: 'recruiter@example.com',
      passwordHash: 'hashed',
      role: 'RECRUITER',
      isApproved: false
    });

    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Recruiter User',
        email: 'recruiter@example.com',
        password: 'supersecret',
        role: 'RECRUITER'
      });

    expect(response.status).toBe(201);
    expect(response.body.user.isApproved).toBe(false);
    expect(prisma.user.create.mock.calls[0][0].data.recruiterProfile.create.approvalStatus).toBe('PENDING');
  });

  it('returns paginated published job listings', async () => {
    prisma.job.findMany.mockResolvedValue([{ id: 'job-1', title: 'Frontend Developer' }]);
    prisma.job.count.mockResolvedValue(1);

    const response = await request(app).get('/api/v1/jobs?q=frontend&page=1');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.pagination.totalPages).toBe(1);
    expect(prisma.job.findMany.mock.calls[0][0].where.isPublished).toBe(true);
  });

  it('filters eligible jobs across the full matching result set for students', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'student-1',
      email: 'student@example.com',
      role: 'STUDENT',
      studentProfile: {
        id: 'student-profile-1',
        branch: 'Computer Science',
        graduationYear: 2027,
        cgpa: 8.1,
        skills: ['React']
      },
      recruiterProfile: null,
      alumniProfile: null
    });
    prisma.job.findMany.mockResolvedValue([
      { id: 'eligible', eligibility: { branches: ['Computer Science'], graduationYears: [2027], minCgpa: 8, skills: ['React'] } },
      { id: 'ineligible', eligibility: { branches: ['Mechanical'] } }
    ]);
    const token = jwt.sign({ sub: 'student-1' }, env.jwtSecret, { expiresIn: '1h' });

    const response = await request(app)
      .get('/api/v1/jobs?eligibleOnly=true&page=1&pageSize=1')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.map((job) => job.id)).toEqual(['eligible']);
    expect(response.body.pagination).toMatchObject({ total: 1, page: 1, pageSize: 1 });
    expect(prisma.job.findMany.mock.calls[0][0]).not.toHaveProperty('skip');
  });

  it('lets approved recruiters update only their connected company', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'recruiter-1',
      email: 'recruiter@example.com',
      role: 'RECRUITER',
      isApproved: true,
      studentProfile: null,
      recruiterProfile: { companyId: 'company-1' },
      alumniProfile: null
    });
    prisma.company.update.mockResolvedValue({ id: 'company-1', name: 'Updated Company' });
    const token = jwt.sign({ sub: 'recruiter-1' }, env.jwtSecret, { expiresIn: '1h' });

    const response = await request(app)
      .patch('/api/v1/companies/mine')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Company' });

    expect(response.status).toBe(200);
    expect(prisma.company.update).toHaveBeenCalledWith({
      where: { id: 'company-1' },
      data: { name: 'Updated Company' }
    });
  });

  it('creates recruiter drafts under the recruiter company only', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'recruiter-1',
      email: 'recruiter@example.com',
      role: 'RECRUITER',
      isApproved: true,
      recruiterProfile: { id: 'recruiter-profile-1', companyId: 'company-1' },
      studentProfile: null,
      alumniProfile: null
    });
    prisma.company.findUnique.mockResolvedValue({ id: 'company-1' });
    prisma.job.create.mockResolvedValue({ id: 'job-1', isPublished: false });

    const token = jwt.sign({ sub: 'recruiter-1' }, env.jwtSecret, { expiresIn: '1h' });
    const response = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Frontend Engineer',
        description: 'Build accessible user interfaces with a collaborative product team.',
        location: 'Remote',
        deadline: new Date(Date.now() + 86400000).toISOString(),
        isPublished: true,
        companyId: 'another-company'
      });

    expect(response.status).toBe(201);
    expect(prisma.job.create.mock.calls[0][0].data.companyId).toBe('company-1');
    expect(prisma.job.create.mock.calls[0][0].data.isPublished).toBe(false);
  });

  it('does not return recruiter password hashes to placement officers', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'officer-1',
      email: 'officer@example.com',
      role: 'PLACEMENT_OFFICER',
      isApproved: true,
      studentProfile: null,
      recruiterProfile: null,
      alumniProfile: null
    });
    prisma.user.findMany.mockResolvedValue([]);

    const token = jwt.sign({ sub: 'officer-1' }, env.jwtSecret, { expiresIn: '1h' });
    const response = await request(app)
      .get('/api/v1/admin/recruiters/pending')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(prisma.user.findMany.mock.calls[0][0].select.passwordHash).toBeUndefined();
  });

  it('audits recruiter approval in the same transaction as the role change', async () => {
    const officer = {
      id: 'officer-1',
      email: 'officer@example.com',
      role: 'PLACEMENT_OFFICER',
      isApproved: true,
      studentProfile: null,
      recruiterProfile: null,
      alumniProfile: null
    };
    prisma.user.findUnique
      .mockResolvedValueOnce(officer)
      .mockResolvedValueOnce({
        id: 'recruiter-1',
        role: 'RECRUITER',
        recruiterProfile: { id: 'recruiter-profile-1' }
      });
    prisma.user.update.mockResolvedValue({
      id: 'recruiter-1',
      email: 'recruiter@example.com',
      role: 'RECRUITER',
      isApproved: true,
      recruiterProfile: { approvalStatus: 'APPROVED' }
    });
    prisma.auditLog.create.mockResolvedValue({});
    prisma.$transaction.mockImplementation(async (callback) => callback({
      user: prisma.user,
      auditLog: prisma.auditLog
    }));
    const token = jwt.sign({ sub: officer.id }, env.jwtSecret, { expiresIn: '1h' });

    const response = await request(app)
      .patch('/api/v1/admin/recruiters/recruiter-1/approval')
      .set('Authorization', `Bearer ${token}`)
      .send({ approved: true });

    expect(response.status).toBe(200);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        actorId: 'officer-1',
        action: 'RECRUITER_APPROVED',
        resourceId: 'recruiter-1',
        details: { approvalStatus: 'APPROVED' }
      })
    }));
  });

  it('prevents recruiters from reading applicants for another company', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'recruiter-1',
      email: 'recruiter@example.com',
      role: 'RECRUITER',
      isApproved: true,
      recruiterProfile: { companyId: 'company-1' },
      studentProfile: null,
      alumniProfile: null
    });
    prisma.job.findFirst.mockResolvedValue(null);

    const token = jwt.sign({ sub: 'recruiter-1' }, env.jwtSecret, { expiresIn: '1h' });
    const response = await request(app)
      .get('/api/v1/jobs/job-from-another-company/applications')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(prisma.application.findMany).not.toHaveBeenCalled();
  });

  it('prevents duplicate applications for an eligible student', async () => {
    const student = {
      id: 'student-profile-1',
      userId: 'student-1',
      branch: 'Computer Science',
      graduationYear: 2027,
      cgpa: 8.2,
      skills: ['JavaScript'],
      resumeUrl: null
    };
    prisma.user.findUnique.mockResolvedValue({
      id: 'student-1',
      email: 'student@example.com',
      role: 'STUDENT',
      isApproved: true,
      studentProfile: student,
      recruiterProfile: null,
      alumniProfile: null
    });
    prisma.job.findFirst.mockResolvedValue({
      id: 'job-1',
      isPublished: true,
      deadline: new Date(Date.now() + 86400000),
      eligibility: null
    });
    prisma.application.findUnique.mockResolvedValue({ id: 'application-1' });

    const token = jwt.sign({ sub: 'student-1' }, env.jwtSecret, { expiresIn: '1h' });
    const response = await request(app)
      .post('/api/v1/jobs/job-1/applications')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/already applied/i);
    expect(prisma.application.create).not.toHaveBeenCalled();
  });

  it('rejects interview scheduling in the past before reading the application', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'recruiter-1',
      email: 'recruiter@example.com',
      role: 'RECRUITER',
      isApproved: true,
      recruiterProfile: { companyId: 'company-1' },
      studentProfile: null,
      alumniProfile: null
    });

    const token = jwt.sign({ sub: 'recruiter-1' }, env.jwtSecret, { expiresIn: '1h' });
    const response = await request(app)
      .patch('/api/v1/applications/application-1/status')
      .set('Authorization', 'Bearer ' + token)
      .send({ status: 'INTERVIEW_SCHEDULED', scheduledAt: '2000-01-01T10:00:00.000Z' });

    expect(response.status).toBe(400);
    expect(response.body.issues[0].message).toMatch(/must be in the future/i);
    expect(prisma.application.findUnique).not.toHaveBeenCalled();
  });

  it('submits an application, tracks it, and notifies the student when an interview is scheduled', async () => {
    const student = {
      id: 'student-profile-1',
      userId: 'student-1',
      branch: 'Computer Science',
      graduationYear: 2027,
      cgpa: 8.2,
      skills: ['JavaScript'],
      resumeUrl: 'private-resume'
    };
    const studentUser = {
      id: 'student-1',
      email: 'student@example.com',
      role: 'STUDENT',
      isApproved: true,
      studentProfile: student,
      recruiterProfile: null,
      alumniProfile: null
    };
    const recruiterUser = {
      id: 'recruiter-1',
      email: 'recruiter@example.com',
      role: 'RECRUITER',
      isApproved: true,
      studentProfile: null,
      recruiterProfile: { companyId: 'company-1' },
      alumniProfile: null
    };
    const application = {
      id: 'application-1',
      jobId: 'job-1',
      studentId: student.id,
      status: 'APPLIED',
      student: { ...student, user: { id: studentUser.id, email: studentUser.email } },
      job: { id: 'job-1', title: 'Frontend Engineer', companyId: 'company-1', company: { name: 'Example Co' } }
    };
    prisma.user.findUnique
      .mockResolvedValueOnce(studentUser)
      .mockResolvedValueOnce(studentUser)
      .mockResolvedValueOnce(recruiterUser)
      .mockResolvedValueOnce(recruiterUser);
    prisma.job.findFirst.mockResolvedValue({
      id: 'job-1',
      title: 'Frontend Engineer',
      isPublished: true,
      deadline: new Date(Date.now() + 86400000),
      eligibility: null
    });
    prisma.application.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...application, status: 'APPLIED' })
      .mockResolvedValueOnce({ ...application, status: 'SHORTLISTED' })
      .mockResolvedValue({ ...application, status: 'SHORTLISTED' });
    prisma.application.create.mockResolvedValue({
      ...application,
      job: { title: 'Frontend Engineer', company: { name: 'Example Co' } }
    });
    prisma.application.findMany.mockResolvedValue([application]);
    prisma.application.update.mockResolvedValue({
      ...application,
      status: 'INTERVIEW_SCHEDULED',
      interview: { scheduledAt: new Date(Date.now() + 172800000), status: 'SCHEDULED' }
    });
    prisma.interview.upsert.mockResolvedValue({});
    prisma.notification.create.mockResolvedValue({});
    prisma.applicationStatusEvent.create.mockResolvedValue({});
    prisma.$transaction.mockImplementation((callback) => callback(prisma));

    const studentToken = jwt.sign({ sub: studentUser.id }, env.jwtSecret, { expiresIn: '1h' });
    const recruiterToken = jwt.sign({ sub: recruiterUser.id }, env.jwtSecret, { expiresIn: '1h' });
    const submitResponse = await request(app)
      .post('/api/v1/jobs/job-1/applications')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({});

    expect(submitResponse.status).toBe(201);
    expect(prisma.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: studentUser.id, title: 'Application submitted' })
    }));

    const trackingResponse = await request(app)
      .get('/api/v1/applications/my')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(trackingResponse.status).toBe(200);
    expect(prisma.application.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { studentId: student.id },
      include: expect.objectContaining({
        statusHistory: { orderBy: { createdAt: 'asc' } }
      })
    }));

    const interviewDate = new Date(Date.now() + 172800000).toISOString();
    const shortlistResponse = await request(app)
      .patch('/api/v1/applications/application-1/status')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ status: 'SHORTLISTED' });
    expect(shortlistResponse.status).toBe(200);

    const statusResponse = await request(app)
      .patch('/api/v1/applications/application-1/status')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ status: 'INTERVIEW_SCHEDULED', scheduledAt: interviewDate, mode: 'Video call' });

    expect(statusResponse.status).toBe(200);
    expect(prisma.notification.create).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: studentUser.id, title: 'Application status updated' })
    }));
    expect(prisma.interview.upsert).toHaveBeenCalled();
    expect(prisma.applicationStatusEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ applicationId: application.id, status: 'INTERVIEW_SCHEDULED' })
    }));
  });

  it('registers a student account and returns a token', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'student-1',
      email: 'student@example.com',
      passwordHash: 'hashed',
      role: 'STUDENT',
      isApproved: true
    });

    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Student User',
        email: 'student@example.com',
        password: 'supersecret'
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.token).toBeTruthy();
    expect(response.body.user.role).toBe('STUDENT');
  });

  it('requires authentication for the current user profile endpoint', async () => {
    const response = await request(app).get('/api/v1/auth/me');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });
});
