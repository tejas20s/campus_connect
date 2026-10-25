import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../lib/api';
import StudentProfilePage from './StudentProfilePage';

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), patch: vi.fn(), post: vi.fn() }
}));

describe('StudentProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({
      data: {
        data: {
          fullName: 'Taylor Student',
          skills: [],
          portfolioLinks: {},
          certifications: [],
          projects: [],
          hasResume: false,
          hasProfileImage: false
        }
      }
    });
    api.patch.mockResolvedValue({ data: { data: { hasResume: false } } });
  });

  it('saves certifications, projects, and labeled professional links', async () => {
    render(
      <MemoryRouter>
        <StudentProfilePage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Add certification' }));
    fireEvent.change(screen.getByLabelText('Certification name'), { target: { value: 'Cloud Practitioner' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add project' }));
    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Campus app' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add GitHub' }));
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://github.com/taylor' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/students/me', expect.objectContaining({
      certifications: [expect.objectContaining({ name: 'Cloud Practitioner' })],
      projects: [expect.objectContaining({ name: 'Campus app' })],
      portfolioLinks: { GitHub: 'https://github.com/taylor' }
    })));
    expect(await screen.findByRole('status')).toHaveTextContent('Profile saved.');
  });
});
