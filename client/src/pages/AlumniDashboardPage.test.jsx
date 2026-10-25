import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../lib/api';
import AlumniDashboardPage from './AlumniDashboardPage';

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn() }
}));

describe('AlumniDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({
      data: {
        data: {
          profile: { id: 'alumni-1', fullName: 'Alex Alumni', isPublic: true, isVerified: false, completion: 80 },
          mentorship: { pending: 2, accepted: 1, recentRequests: [] },
          resources: [],
          recommendations: [],
          volunteering: [],
          upcomingDrives: []
        }
      }
    });
  });

  it('loads the alumni-specific overview and contribution workflows', async () => {
    render(
      <MemoryRouter>
        <AlumniDashboardPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Welcome, Alex Alumni' })).toBeInTheDocument();
    expect(screen.getByText('Profile completion')).toBeInTheDocument();
    expect(screen.getByText('Incoming requests')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Share a career resource' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recommend an opportunity' })).toBeInTheDocument();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/alumni/dashboard'));
  });
});
