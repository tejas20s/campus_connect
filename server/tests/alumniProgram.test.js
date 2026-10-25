import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  careerResourceCreate: vi.fn(),
  careerResourceFindMany: vi.fn(),
  opportunityFindMany: vi.fn(),
  opportunityCreate: vi.fn(),
  alumniFindMany: vi.fn(),
  mentorshipFindMany: vi.fn(),
  mentorshipFindUnique: vi.fn(),
  mentorshipMessageFindMany: vi.fn(),
  mentorshipMessageCreate: vi.fn(),
  mentorshipCount: vi.fn(),
  driveVolunteerFindMany: vi.fn(),
  driveFindMany: vi.fn(),
  notificationFindMany: vi.fn(),
  transaction: vi.fn()
}));

vi.mock('../src/db/prisma.js', () => ({
  prisma: {
    revokedToken: { findUnique: vi.fn() },
    user: { findUnique: mocks.userFindUnique },
    alumniProfile: { findMany: mocks.alumniFindMany },
    careerResource: { findMany: mocks.careerResourceFindMany, create: mocks.careerResourceCreate },
    opportunityRecommendation: { findMany: mocks.opportunityFindMany, create: mocks.opportunityCreate },
    mentorshipRequest: {
      findMany: mocks.mentorshipFindMany,
      findUnique: mocks.mentorshipFindUnique,
      count: mocks.mentorshipCount
    },
    mentorshipMessage: { findMany: mocks.mentorshipMessageFindMany, create: mocks.mentorshipMessageCreate },
    driveVolunteer: { findMany: mocks.driveVolunteerFindMany },
    placementDrive: { findMany: mocks.driveFindMany },
    notification: { findMany: mocks.notificationFindMany },
    $transaction: mocks.transaction
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

describe('alumni program routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setUser(role) {
    const user = {
      id: `${role.toLowerCase()}-user`,
      email: `${role.toLowerCase()}@example.com`,
      role,
      isApproved: true,
      studentProfile: role === 'STUDENT' ? { id: 'student-profile' } : null,
      recruiterProfile: null,
      alumniProfile: role === 'ALUMNI' ? {
        id: 'alumni-profile',
        userId: 'alumni-user',
        fullName: 'Alex Alumni',
        isPublic: true,
        isVerified: false,
        skills: ['Cloud'],
        mentoringTopics: ['Cloud engineering'],
        professionalExperience: 'Cloud Engineer'
      } : null
    };
    mocks.userFindUnique.mockResolvedValue(user);
    return jwt.sign({ sub: user.id }, env.jwtSecret, { expiresIn: '1h' });
  }

  it('loads the alumni dashboard using the signed-in alumni profile', async () => {
    const token = setUser('ALUMNI');
    mocks.mentorshipFindMany.mockResolvedValue([]);
    mocks.careerResourceFindMany.mockResolvedValue([]);
    mocks.opportunityFindMany.mockResolvedValue([]);
    mocks.driveVolunteerFindMany.mockResolvedValue([]);
    mocks.driveFindMany.mockResolvedValue([]);

    const response = await request(app)
      .get('/alumni/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.profile.fullName).toBe('Alex Alumni');
    expect(mocks.mentorshipFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { alumniId: 'alumni-profile' }
    }));
  });

  it('only allows alumni to submit reviewed career resources', async () => {
    const token = setUser('ALUMNI');
    mocks.careerResourceCreate.mockResolvedValue({
      id: 'resource-1',
      title: 'Interview roadmap',
      status: 'PENDING',
      alumniId: 'alumni-profile'
    });

    const response = await request(app)
      .post('/career-resources')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Interview roadmap',
        summary: 'A practical checklist for technical interviews.',
        url: 'https://example.com/guide',
        category: 'Interview preparation'
      });

    expect(response.status).toBe(201);
    expect(mocks.careerResourceCreate.mock.calls[0][0].data.alumniId).toBe('alumni-profile');
    expect(mocks.careerResourceCreate.mock.calls[0][0].data).not.toHaveProperty('status');
    expect(response.body.data.status).toBe('PENDING');
  });

  it('does not allow students to submit alumni opportunity recommendations', async () => {
    const token = setUser('STUDENT');

    const response = await request(app)
      .post('/opportunity-recommendations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Engineer',
        company: 'Example',
        location: 'Remote',
        type: 'FULL_TIME',
        url: 'https://example.com/jobs',
        details: 'A useful role for graduating students.'
      });

    expect(response.status).toBe(403);
    expect(mocks.opportunityCreate).not.toHaveBeenCalled();
  });

  it('lists only approved resources for students', async () => {
    const token = setUser('STUDENT');
    mocks.careerResourceFindMany.mockResolvedValue([{ id: 'resource-1', title: 'Interview guide' }]);

    const response = await request(app)
      .get('/career-resources')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(mocks.careerResourceFindMany.mock.calls[0][0].where).toEqual({ status: 'APPROVED' });
  });

  it('prevents a non-participant from reading a mentorship conversation', async () => {
    const token = setUser('STUDENT');
    mocks.mentorshipFindUnique.mockResolvedValue({
      id: 'request-1',
      status: 'ACCEPTED',
      studentId: 'another-student-profile',
      alumniId: 'alumni-profile'
    });

    const response = await request(app)
      .get('/mentorship-requests/request-1/messages')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(mocks.mentorshipMessageFindMany).not.toHaveBeenCalled();
  });

  it('keeps mentorship messaging disabled until the request is accepted', async () => {
    const token = setUser('ALUMNI');
    mocks.mentorshipFindUnique.mockResolvedValue({
      id: 'request-1',
      status: 'PENDING',
      studentId: 'student-profile',
      alumniId: 'alumni-profile'
    });

    const response = await request(app)
      .get('/mentorship-requests/request-1/messages')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(409);
    expect(mocks.mentorshipMessageFindMany).not.toHaveBeenCalled();
  });
});
