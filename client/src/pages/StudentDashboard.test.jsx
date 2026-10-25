import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../lib/api';
import StudentDashboard from './StudentDashboard';

vi.mock('../lib/api', () => ({
  api: { get: vi.fn() }
}));

describe('StudentDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation((path) => {
      const values = {
        '/students/me': {
          fullName: 'Taylor Student',
          branch: 'Computer Science',
          graduationYear: 2027,
          cgpa: 8.5,
          skills: ['React'],
          hasResume: true
        },
        '/applications/my': [{
          id: 'application-1',
          job: { title: 'Frontend Engineer' },
          interview: {
            status: 'SCHEDULED',
            scheduledAt: new Date(Date.now() + 86400000).toISOString(),
            mode: 'Video'
          }
        }],
        '/notifications': [{ id: 'notification-1', isRead: false }],
        '/announcements': [{ id: 'announcement-1', title: 'Placement orientation', message: 'Join us soon.' }],
        '/placement-drives': [],
        '/jobs?pageSize=50': [{
          id: 'job-1',
          eligibility: { skills: ['React', 'TypeScript'] }
        }]
      };
      return Promise.resolve({ data: { data: values[path] || [] } });
    });
  });

  it('shows database-backed interview, placement, and skill preparation summaries', async () => {
    render(
      <MemoryRouter>
        <StudentDashboard user={{ email: 'taylor@example.com' }} />
      </MemoryRouter>
    );

    expect(await screen.findByText('Frontend Engineer')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Placement orientation')).toBeInTheDocument();
    expect(screen.getByText(/Unread updates/)).toBeInTheDocument();
  });
});
