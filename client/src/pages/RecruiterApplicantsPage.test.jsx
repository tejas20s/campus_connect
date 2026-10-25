import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../lib/api';
import RecruiterApplicantsPage from './RecruiterApplicantsPage';

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), patch: vi.fn() }
}));

describe('RecruiterApplicantsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({
      data: {
        data: [{
          id: 'application-1',
          status: 'APPLIED',
          appliedAt: '2026-10-01T12:00:00.000Z',
          job: { title: 'Frontend Engineer' },
          student: {
            id: 'student-profile-1',
            fullName: 'Sam Student',
            user: { email: 'student@example.com' },
            skills: []
          }
        }]
      }
    });
    vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  it('opens an applicant resume from the recruiter review screen', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/jobs/job-1/applications') {
        return Promise.resolve({
          data: {
            data: [{
              id: 'application-1',
              status: 'APPLIED',
              job: { title: 'Frontend Engineer' },
              student: {
                id: 'student-profile-1',
                fullName: 'Sam Student',
                user: { email: 'student@example.com' },
                skills: []
              }
            }]
          }
        });
      }
      return Promise.resolve({ data: { data: { url: 'https://files.example/resume.pdf' } } });
    });

    render(
      <MemoryRouter initialEntries={['/recruiter/jobs/job-1/applications']}>
        <Routes>
          <Route path="/recruiter/jobs/:jobId/applications" element={<RecruiterApplicantsPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'View private resume' }));

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/students/student-profile-1/resume');
      expect(window.open).toHaveBeenCalledWith('https://files.example/resume.pdf', '_blank', 'noopener,noreferrer');
    });
  });
});
