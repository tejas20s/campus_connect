import { Link, Navigate } from 'react-router-dom';
import StudentDashboard from './StudentDashboard';
import LogoutButton from '../components/LogoutButton';

const getStoredUser = () => {
  try {
    const raw = sessionStorage.getItem('campusconnect_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const roleLabel = {
  STUDENT: 'Student Dashboard',
  RECRUITER: 'Recruiter Dashboard',
  PLACEMENT_OFFICER: 'Placement Officer Dashboard',
  ALUMNI: 'Alumni Dashboard'
};

const roleDescription = {
  STUDENT: 'Your opportunities, applications, profile, and alumni connections—ready when you are.',
  RECRUITER: 'Manage your company presence, opportunities, and candidate conversations.',
  PLACEMENT_OFFICER: 'Coordinate campus hiring, support students, and follow placement outcomes.',
  ALUMNI: 'Keep your professional profile current and share guidance with students.'
};

export default function DashboardPage() {
  const user = getStoredUser();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'ALUMNI') {
    return <Navigate to="/alumni/dashboard" replace />;
  }
  if (user.role === 'STUDENT') {
    return <StudentDashboard user={user} />;
  }

  const actions = {
    STUDENT: [
      ['Browse opportunities', 'Explore roles and internships matched to your next step.', '/jobs', true],
      ['My applications', 'Check application progress and upcoming interviews.', '/applications'],
      ['Your profile', 'Update academic details, skills, and private resume.', '/profile'],
      ['Find alumni mentors', 'Connect with graduates who can share career advice.', '/alumni'],
      ['Career resources', 'Read approved alumni advice and opportunity recommendations.', '/career-resources']
    ],
    RECRUITER: user.isApproved ? [
      ['Company and openings', 'Update your company profile and manage job opportunities.', '/recruiter/jobs', true]
    ] : [],
    PLACEMENT_OFFICER: [
      ['Recruiter approvals', 'Review new recruiter accounts and approval requests.', '/admin/recruiters', true],
      ['Placement analytics', 'Explore placement reports, announcements, and campus drives.', '/admin/analytics'],
      ['Student management', 'Search student academic records and application totals.', '/admin/students'],
      ['Alumni participation', 'Verify alumni and review resources, opportunity leads, and event volunteers.', '/admin/alumni-review']
    ],
    ALUMNI: []
  }[user.role] || [];

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <Link to="/" className="flex items-center gap-3 text-lg font-bold tracking-tight text-slate-950">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-xl text-white">C</span>
            <span>Campus<span className="text-blue-600">Connect</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/notifications" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">Notifications</Link>
            <LogoutButton className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50" />
          </div>
        </header>

        <section className="relative mt-7 overflow-hidden rounded-3xl bg-[#101b36] px-6 py-8 text-white shadow-xl shadow-slate-900/10 sm:px-9 sm:py-10">
          <div className="pointer-events-none absolute -right-8 -top-24 h-72 w-72 rounded-full border-[40px] border-white/[0.04]" />
          <div className="pointer-events-none absolute -right-2 top-6 h-44 w-44 rounded-full bg-blue-500/15 blur-3xl" />
          <div className="relative max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-blue-200">
              <span className={`h-2 w-2 rounded-full ${user.role === 'RECRUITER' && !user.isApproved ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              {user.role === 'RECRUITER' && !user.isApproved ? 'Approval pending' : 'Your workspace'}
            </p>
            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">{roleLabel[user.role] || 'Dashboard'}</h1>
            <p className="mt-2 text-sm text-slate-300">Welcome back, <span className="font-semibold text-white">{user.email}</span></p>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">{roleDescription[user.role]}</p>
          </div>
        </section>

        {user.role === 'RECRUITER' && !user.isApproved && (
          <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            Your recruiter account is awaiting placement-office approval. You’ll be able to manage company details and openings once approved.
          </p>
        )}

        <section className="mt-9">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Quick access</p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">Your next steps</h2>
            </div>
            <span className="hidden text-sm text-slate-500 sm:block">{actions.length} tools for your role</span>
          </div>
          {actions.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {actions.map(([title, description, to, primary]) => (
                <Link key={to} to={to} className={`group flex min-h-40 flex-col rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:shadow-lg ${primary ? 'border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-600/15 hover:bg-blue-700' : 'border-slate-200 bg-white text-slate-900 hover:border-blue-200'}`}>
                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg ${primary ? 'bg-white/15 text-white' : 'bg-blue-50 text-blue-700'}`} aria-hidden="true">↗</span>
                  <h3 className="mt-5 font-bold">{title}</h3>
                  <p className={`mt-1 text-sm leading-5 ${primary ? 'text-blue-100' : 'text-slate-500'}`}>{description}</p>
                  <span className={`mt-auto pt-4 text-xs font-semibold ${primary ? 'text-white' : 'text-blue-700'}`}>Open workspace <span aria-hidden="true">→</span></span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-6 text-slate-600">
              Your recruiter account is waiting for approval. You’ll see company and job tools here when access is granted.
            </div>
          )}
        </section>

        <footer className="mt-10 border-t border-slate-200 py-5 text-center text-xs text-slate-500">
          CampusConnect <span className="mx-1 text-slate-300">·</span> From campus to career
        </footer>
      </div>
    </main>
  );
}
