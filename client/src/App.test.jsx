import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

describe('App', () => {
  it('renders the landing page', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getAllByText(/CampusConnect/i).length).toBeGreaterThan(0);
  });

  it('links the landing page navigation to sections and login', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    expect(document.getElementById('features')).toBeInTheDocument();
    expect(document.getElementById('roles')).toBeInTheDocument();
    expect(document.getElementById('analytics')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Platform' })).toHaveAttribute('href', '#features');
    expect(screen.getByRole('link', { name: 'Who it’s for' })).toHaveAttribute('href', '#roles');
    expect(screen.getByRole('link', { name: 'How it works' })).toHaveAttribute('href', '#how-it-works');

    fireEvent.click(screen.getAllByRole('link', { name: 'Sign in' })[0]);
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('opens the mobile navigation and provides a registration action', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(screen.getByRole('button', { name: 'Close navigation menu' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('link', { name: 'Get started' })).toHaveLength(3);
  });

  it('shows Placement Officer quick-access tools on the dashboard', () => {
    sessionStorage.setItem('campusconnect_user', JSON.stringify({
      id: 'officer-1',
      email: 'officer@example.com',
      role: 'PLACEMENT_OFFICER',
      isApproved: true
    }));

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Placement Officer Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Recruiter approvals/ })).toHaveAttribute('href', '/admin/recruiters');
    expect(screen.getByRole('link', { name: /Student management/ })).toHaveAttribute('href', '/admin/students');
    sessionStorage.removeItem('campusconnect_user');
  });

  it('denies student access to the Placement Officer student registry', () => {
    sessionStorage.setItem('campusconnect_user', JSON.stringify({
      id: 'student-1',
      email: 'student@example.com',
      role: 'STUDENT'
    }));

    render(
      <MemoryRouter initialEntries={['/admin/students']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Unauthorized' })).toBeInTheDocument();
    sessionStorage.removeItem('campusconnect_user');
  });
});
