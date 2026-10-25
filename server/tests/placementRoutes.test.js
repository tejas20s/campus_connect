import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userFindMany: vi.fn(),
  userCount: vi.fn(),
  studentCount: vi.fn(),
  alumniCount: vi.fn(),
  jobCount: vi.fn(),
  applicationCount: vi.fn(),
  applicationFindMany: vi.fn(),
  announcementFindMany: vi.fn(),
  announcementCreate: vi.fn(),
  announcementFindUnique: vi.fn(),
  announcementUpdate: vi.fn(),
  driveFindMany: vi.fn(),
  driveCreate: vi.fn(),
  driveFindUnique: vi.fn(),
  driveUpdate: vi.fn(),
  companyFindMany: vi.fn(),
  notificationFindMany: vi.fn(),
  notificationFindFirst: vi.fn(),
  notificationUpdate: vi.fn(),
  notificationCreateMany: vi.fn(),
  transaction: vi.fn()
}));

vi.mock('../src/db/prisma.js', () => ({
  prisma: {
    revokedToken: { findUnique: vi.fn() },
    user: { findUnique: mocks.userFindUnique, findMany: mocks.userFindMany, count: mocks.userCount },
    studentProfile: { count: mocks.studentCount },
    alumniProfile: { count: mocks.alumniCount },
    job: { count: mocks.jobCount },
    application: { count: mocks.applicationCount, findMany: mocks.applicationFindMany },
    announcement: {
      findMany: mocks.announcementFindMany,
      create: mocks.announcementCreate,
      findUnique: mocks.announcementFindUnique,
      update: mocks.announcementUpdate
    },
    placementDrive: {
      findMany: mocks.driveFindMany,
      create: mocks.driveCreate,
      findUnique: mocks.driveFindUnique,
      update: mocks.driveUpdate
    },
    company: { findMany: mocks.companyFindMany },
    notification: {
      findMany: mocks.notificationFindMany,
      findFirst: mocks.notificationFindFirst,
      update: mocks.notificationUpdate,
      createMany: mocks.notificationCreateMany
    },
    $transaction: mocks.transaction
  }
}));

import placementRoutes from '../src/routes/placementRoutes.js';
import { env } from '../src/config/env.js';

const app = express();
app.use(express.json());
app.use(placementRoutes);
app.use((error, req, res, next) => {
  res.status(500).json({ success: false, message: error.message });
});

function tokenFor(id) {
  return jwt.sign({ sub: id }, env.jwtSecret, { expiresIn: '1h' });
}

describe('placement analytics and publishing routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation((callback) => callback({
      user: { findMany: mocks.userFindMany },
      announcement: { create: mocks.announcementCreate, update: mocks.announcementUpdate },
      placementDrive: { create: mocks.driveCreate, update: mocks.driveUpdate },
      notification: { createMany: mocks.notificationCreateMany }
    }));
  });

  it('restricts analytics to placement officers', async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: 'student-1',
      role: 'STUDENT',
      studentProfile: { id: 'student-profile-1' },
      alumniProfile: null,
      recruiterProfile: null
    });
    const response = await request(app)
      .get('/analytics/overview')
      .set('Authorization', `Bearer ${tokenFor('student-1')}`);

    expect(response.status).toBe(403);
    expect(mocks.studentCount).not.toHaveBeenCalled();
  });

  it('calculates placement metrics from database counts and unique placed students', async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: 'officer-1',
      role: 'PLACEMENT_OFFICER',
      studentProfile: null,
      alumniProfile: null,
      recruiterProfile: null
    });
    mocks.studentCount.mockResolvedValue(4);
    mocks.alumniCount.mockResolvedValue(2);
    mocks.userCount.mockResolvedValue(3);
    mocks.jobCount.mockResolvedValue(5);
    mocks.applicationCount
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(3);
    mocks.applicationFindMany.mockResolvedValue([{ studentId: 's1' }, { studentId: 's2' }]);

    const response = await request(app)
      .get('/analytics/overview')
      .set('Authorization', `Bearer ${tokenFor('officer-1')}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      students: 4,
      alumni: 2,
      approvedRecruiters: 3,
      publishedJobs: 5,
      applications: 12,
      shortlisted: 4,
      selectedApplications: 3,
      placedStudents: 2,
      placementRate: 50
    });
  });

  it('rejects a reversed analytics date range', async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: 'officer-1',
      role: 'PLACEMENT_OFFICER',
      studentProfile: null,
      alumniProfile: null,
      recruiterProfile: null
    });
    const response = await request(app)
      .get('/analytics/overview?from=2026-12-01T00:00:00.000Z&to=2026-01-01T00:00:00.000Z')
      .set('Authorization', `Bearer ${tokenFor('officer-1')}`);

    expect(response.status).toBe(400);
    expect(mocks.studentCount).not.toHaveBeenCalled();
  });

  it('lists all placement drives for placement officers to manage', async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: 'officer-1',
      role: 'PLACEMENT_OFFICER',
      studentProfile: null,
      alumniProfile: null,
      recruiterProfile: null
    });

    mocks.driveFindMany.mockResolvedValue([]);

    const response = await request(app)
      .get('/placement-drives/manage')
      .set('Authorization', `Bearer ${tokenFor('officer-1')}`);

    expect(response.status).toBe(200);
    expect(mocks.driveFindMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { date: 'asc' },
      take: 100
    }));
  });

  it('lists unpublished announcements for Placement Officer management', async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: 'officer-1',
      role: 'PLACEMENT_OFFICER',
      studentProfile: null,
      alumniProfile: null,
      recruiterProfile: null
    });
    mocks.announcementFindMany.mockResolvedValue([{ id: 'announcement-1', isPublished: false }]);

    const response = await request(app)
      .get('/announcements/manage')
      .set('Authorization', `Bearer ${tokenFor('officer-1')}`);

    expect(response.status).toBe(200);
    expect(response.body.data[0].isPublished).toBe(false);
    expect(mocks.announcementFindMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 100,
      orderBy: { createdAt: 'desc' }
    }));
  });

  it('attributes each placed student to their earliest selected company deterministically', async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: 'officer-1',
      role: 'PLACEMENT_OFFICER',
      studentProfile: null,
      alumniProfile: null,
      recruiterProfile: null
    });
    mocks.applicationFindMany.mockResolvedValue([
      {
        id: 'application-first',
        studentId: 'student-1',
        student: { branch: 'Computer Science', graduationYear: 2027 },
        job: { company: { name: 'First Company' } }
      },
      {
        id: 'application-second',
        studentId: 'student-1',
        student: { branch: 'Computer Science', graduationYear: 2027 },
        job: { company: { name: 'Second Company' } }
      }
    ]);

    const response = await request(app)
      .get('/analytics/placements')
      .set('Authorization', `Bearer ${tokenFor('officer-1')}`);

    expect(response.status).toBe(200);
    expect(response.body.data.byCompany).toEqual([{ name: 'First Company', placements: 1 }]);
    expect(mocks.applicationFindMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ appliedAt: 'asc' }, { id: 'asc' }]
    }));
  });

  it('exports selected placement rows as escaped CSV', async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: 'officer-1',
      role: 'PLACEMENT_OFFICER',
      studentProfile: null,
      alumniProfile: null,
      recruiterProfile: null
    });
    mocks.applicationFindMany.mockResolvedValue([{
      appliedAt: new Date('2026-10-01T00:00:00.000Z'),
      student: { fullName: 'Test, Student', branch: 'Computer Science', graduationYear: 2027 },
      job: { title: 'Engineer', company: { name: 'Northstar "Demo"' } }
    }]);
    const response = await request(app)
      .get('/analytics/export.csv')
      .set('Authorization', `Bearer ${tokenFor('officer-1')}`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.text).toContain('"Test, Student"');
    expect(response.text).toContain('"Northstar ""Demo"""');
  });

  it('rejects invalid announcements before saving', async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: 'officer-1',
      role: 'PLACEMENT_OFFICER',
      studentProfile: null,
      alumniProfile: null,
      recruiterProfile: null
    });
    const response = await request(app)
      .post('/announcements')
      .set('Authorization', `Bearer ${tokenFor('officer-1')}`)
      .send({ title: '', message: 'x', isPublished: true });

    expect(response.status).toBe(400);
    expect(mocks.announcementCreate).not.toHaveBeenCalled();
  });

  it('notifies students when a placement officer publishes an announcement', async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: 'officer-1',
      role: 'PLACEMENT_OFFICER',
      studentProfile: null,
      alumniProfile: null,
      recruiterProfile: null
    });
    mocks.announcementCreate.mockResolvedValue({
      id: 'announcement-1',
      title: 'Placement orientation',
      isPublished: true
    });
    mocks.userFindMany.mockResolvedValue([{ id: 'student-1' }, { id: 'student-2' }]);

    const response = await request(app)
      .post('/announcements')
      .set('Authorization', `Bearer ${tokenFor('officer-1')}`)
      .send({ title: 'Placement orientation', message: 'Join the placement orientation this week.' });

    expect(response.status).toBe(201);
    expect(mocks.notificationCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ userId: 'student-1', title: 'New placement announcement' }),
        expect.objectContaining({ userId: 'student-2', link: '/dashboard' })
      ])
    });
  });
});
