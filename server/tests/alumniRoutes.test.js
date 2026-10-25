import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  queryRaw: vi.fn().mockResolvedValue([]),
  alumniFindMany: vi.fn(),
  alumniFindFirst: vi.fn(),
  alumniFindUnique: vi.fn(),
  alumniCount: vi.fn(),
  alumniUpdate: vi.fn(),
  mentorshipFindMany: vi.fn(),
  mentorshipFindFirst: vi.fn(),
  mentorshipCreate: vi.fn(),
  mentorshipUpdateMany: vi.fn(),
  notificationCreate: vi.fn(),
  transaction: vi.fn()
}));

vi.mock('../src/db/prisma.js', () => ({
  prisma: {
    revokedToken: { findUnique: vi.fn() },
    user: { findUnique: mocks.userFindUnique },
    alumniProfile: {
      findMany: mocks.alumniFindMany,
      findFirst: mocks.alumniFindFirst,
      findUnique: mocks.alumniFindUnique,
      count: mocks.alumniCount,
      update: mocks.alumniUpdate
    },
    mentorshipRequest: {
      findMany: mocks.mentorshipFindMany,
      findFirst: mocks.mentorshipFindFirst,
      create: mocks.mentorshipCreate,
      updateMany: mocks.mentorshipUpdateMany
    },
    notification: { create: mocks.notificationCreate },
    $transaction: mocks.transaction,
    $queryRaw: mocks.queryRaw
  }
}));

import alumniRoutes from '../src/routes/alumniRoutes.js';
import { env } from '../src/config/env.js';

const app = express();
app.use(express.json());
app.use(alumniRoutes);
app.use((error, req, res, next) => {
  res.status(500).json({ success: false, message: error.message });
});

function tokenFor(userId) {
  return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: '1h' });
}

function transactionClient() {
  return {
    mentorshipRequest: {
      findFirst: mocks.mentorshipFindFirst,
      create: mocks.mentorshipCreate,
      updateMany: mocks.mentorshipUpdateMany
    },
    notification: { create: mocks.notificationCreate }
  };
}

describe('alumni and mentorship routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation((callbackOrOperations) => (
      Array.isArray(callbackOrOperations)
        ? Promise.all(callbackOrOperations)
        : callbackOrOperations(transactionClient())
    ));
  });

  it('lists only public-safe fields and filters to public profiles', async () => {
    mocks.alumniFindMany.mockResolvedValue([{ id: 'alumni-1', fullName: 'Alex Graduate' }]);
    mocks.alumniCount.mockResolvedValue(1);

    const response = await request(app).get('/alumni?q=alex&page=2&pageSize=5');

    expect(response.status).toBe(200);
    expect(response.body.pagination).toEqual({ page: 2, pageSize: 5, total: 1, totalPages: 1 });
    expect(mocks.queryRaw.mock.calls[0][1]).toBe('alex');
    expect(mocks.alumniFindMany.mock.calls[0][0].where.isPublic).toBe(true);
    expect(mocks.alumniFindMany.mock.calls[0][0].select).not.toHaveProperty('user');
    expect(mocks.alumniFindMany.mock.calls[0][0].select).not.toHaveProperty('email');
  });

  it('creates a student mentorship request and notification in one transaction', async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: 'student-user',
      role: 'STUDENT',
      studentProfile: { id: 'student-profile', fullName: 'Sam Student' },
      recruiterProfile: null,
      alumniProfile: null
    });
    mocks.alumniFindFirst.mockResolvedValue({
      id: 'alumni-profile',
      userId: 'alumni-user',
      fullName: 'Alex Graduate'
    });
    mocks.mentorshipFindFirst.mockResolvedValue(null);
    mocks.mentorshipCreate.mockResolvedValue({
      id: 'request-1',
      status: 'PENDING',
      message: 'I would appreciate career advice.',
      alumni: { id: 'alumni-profile', fullName: 'Alex Graduate' }
    });

    const response = await request(app)
      .post('/mentorship-requests')
      .set('Authorization', `Bearer ${tokenFor('student-user')}`)
      .send({ alumniId: 'alumni-profile', message: 'I would appreciate career advice.' });

    expect(response.status).toBe(201);
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.notificationCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'alumni-user' })
    }));
    expect(response.body.data).not.toHaveProperty('alumni.user');
  });

  it('rejects repeated pending or accepted requests without notifying again', async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: 'student-user',
      role: 'STUDENT',
      studentProfile: { id: 'student-profile', fullName: 'Sam Student' },
      recruiterProfile: null,
      alumniProfile: null
    });
    mocks.alumniFindFirst.mockResolvedValue({
      id: 'alumni-profile',
      userId: 'alumni-user',
      fullName: 'Alex Graduate'
    });
    mocks.mentorshipFindFirst.mockResolvedValue({ id: 'existing-request' });

    const response = await request(app)
      .post('/mentorship-requests')
      .set('Authorization', `Bearer ${tokenFor('student-user')}`)
      .send({ alumniId: 'alumni-profile', message: 'I would appreciate career advice.' });

    expect(response.status).toBe(409);
    expect(mocks.mentorshipCreate).not.toHaveBeenCalled();
    expect(mocks.notificationCreate).not.toHaveBeenCalled();
  });

  it('scopes received mentorship requests to the signed-in alum', async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: 'alumni-user',
      role: 'ALUMNI',
      alumniProfile: { id: 'alumni-profile' },
      studentProfile: null,
      recruiterProfile: null
    });
    mocks.mentorshipFindMany.mockResolvedValue([]);

    const response = await request(app)
      .get('/mentorship-requests')
      .set('Authorization', `Bearer ${tokenFor('alumni-user')}`);

    expect(response.status).toBe(200);
    expect(mocks.mentorshipFindMany.mock.calls[0][0].where).toEqual({ alumniId: 'alumni-profile' });
  });

  it('lets only the target alum decide a pending request and notifies the student', async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: 'alumni-user',
      role: 'ALUMNI',
      alumniProfile: { id: 'alumni-profile' },
      studentProfile: null,
      recruiterProfile: null
    });
    mocks.mentorshipFindFirst.mockResolvedValue({
      id: 'request-1',
      studentId: 'student-profile',
      message: 'I would appreciate career advice.',
      status: 'PENDING',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      student: {
        id: 'student-profile',
        userId: 'student-user',
        fullName: 'Sam Student',
        branch: 'Computer Science',
        graduationYear: 2027
      },
      alumni: { id: 'alumni-profile', fullName: 'Alex Graduate' }
    });
    mocks.mentorshipUpdateMany.mockResolvedValue({ count: 1 });
    mocks.notificationCreate.mockResolvedValue({});

    const response = await request(app)
      .patch('/mentorship-requests/request-1')
      .set('Authorization', `Bearer ${tokenFor('alumni-user')}`)
      .send({ status: 'ACCEPTED' });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('ACCEPTED');
    expect(response.body.data.student).not.toHaveProperty('userId');
    expect(mocks.mentorshipUpdateMany.mock.calls[0][0].where).toMatchObject({
      id: 'request-1',
      alumniId: 'alumni-profile',
      status: 'PENDING'
    });
    expect(mocks.notificationCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'student-user' })
    }));
  });
});
