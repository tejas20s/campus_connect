import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../lib/api';
import JobsPage from './JobsPage';

vi.mock('../lib/api', () => ({
  api: { get: vi.fn() }
}));

describe('JobsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.setItem('campusconnect_user', JSON.stringify({ role: 'STUDENT' }));
    api.get.mockImplementation((path, options) => {
      if (path === '/students/me') {
        return Promise.resolve({ data: { data: { branch: 'Computer Science', graduationYear: 2027, cgpa: 8.2, skills: ['React'] } } });
      }
      const page = options.params.page;
      return Promise.resolve({
        data: {
          data: [{
            id: `job-${page}`,
            title: `Job page ${page}`,
            type: 'FULL_TIME',
            location: 'Remote',
            deadline: '2027-01-01T00:00:00.000Z',
            description: 'A frontend engineering role for students.'
          }],
          pagination: { page, pageSize: 30, total: 31, totalPages: 2 }
        }
      });
    });
  });

  it('advances pagination instead of resetting to the first page', async () => {
    render(<MemoryRouter><JobsPage /></MemoryRouter>);

    expect(await screen.findByText('Job page 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('Job page 2')).toBeInTheDocument();
    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument();
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/jobs', expect.objectContaining({
        params: expect.objectContaining({ page: 2 })
      }));
    });
  });
});
