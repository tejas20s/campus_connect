import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import LogoutButton from '../components/LogoutButton';

const resourceDefaults = { title: '', summary: '', url: '', category: 'Interview preparation' };
const opportunityDefaults = {
  title: '',
  company: '',
  location: '',
  type: 'FULL_TIME',
  url: '',
  details: ''
};

const inputClass = 'mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500';
const statusClass = {
  PENDING: 'bg-amber-400/10 text-amber-200',
  APPROVED: 'bg-emerald-400/10 text-emerald-200',
  REJECTED: 'bg-rose-400/10 text-rose-200'
};

export default function AlumniDashboardPage() {
  const [data, setData] = useState(null);
  const [resourceForm, setResourceForm] = useState(resourceDefaults);
  const [opportunityForm, setOpportunityForm] = useState(opportunityDefaults);
  const [volunteerNotes, setVolunteerNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadDashboard = useCallback(async () => {
    const response = await api.get('/alumni/dashboard');
    setData(response.data.data);
  }, []);

  useEffect(() => {
    let active = true;
    loadDashboard()
      .then(() => {
        if (active) setError('');
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load your alumni dashboard.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadDashboard]);

  async function submitContribution(event, kind) {
    event.preventDefault();
    setSaving(kind);
    setError('');
    setMessage('');
    try {
      if (kind === 'resource') {
        await api.post('/career-resources', resourceForm);
        setResourceForm(resourceDefaults);
        setMessage('Career resource submitted for Placement Office review.');
      } else {
        await api.post('/opportunity-recommendations', opportunityForm);
        setOpportunityForm(opportunityDefaults);
        setMessage('Opportunity recommendation submitted for Placement Office review.');
      }
      await loadDashboard();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to submit your contribution.');
    } finally {
      setSaving('');
    }
  }

  async function volunteer(driveId) {
    setSaving(driveId);
    setError('');
    setMessage('');
    try {
      await api.post(`/placement-drives/${driveId}/volunteer`, { note: volunteerNotes[driveId] || '' });
      setMessage('Volunteer request submitted for Placement Office review.');
      await loadDashboard();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to volunteer for this event.');
    } finally {
      setSaving('');
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-slate-950 p-8 text-slate-300">Loading alumni workspace...</main>;
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-50">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
          <p role="alert" className="text-red-100">{error || 'Unable to load the alumni dashboard.'}</p>
        </div>
      </main>
    );
  }

  const volunteerDriveIds = new Set(data.volunteering.map((item) => item.driveId));

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link to="/dashboard" className="text-sm font-semibold text-brand-300">← All role dashboards</Link>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-brand-300">Alumni network</p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Welcome, {data.profile.fullName}</h1>
            <p className="mt-2 max-w-2xl text-slate-400">Share your experience, mentor students, and take part in campus career events.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/alumni/me" className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold hover:border-slate-500">Edit profile</Link>
            <Link to="/notifications" className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold hover:border-slate-500">Notifications</Link>
            <LogoutButton className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold hover:border-red-500/50 hover:text-red-200 disabled:opacity-50" />
          </div>
        </header>

        {error && <p role="alert" className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">{error}</p>}
        {message && <p role="status" className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">{message}</p>}

        <section aria-label="Alumni overview" className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <OverviewCard label="Profile completion" value={`${data.profile.completion}%`} detail={data.profile.isVerified ? 'Verified by Placement Office' : 'Awaiting Placement Office verification'} />
          <OverviewCard label="Incoming requests" value={data.mentorship.pending} detail="Students waiting for a response" />
          <OverviewCard label="Active mentees" value={data.mentorship.accepted} detail="Accepted mentorship conversations" />
          <OverviewCard label="Shared contributions" value={data.resources.length + data.recommendations.length} detail="Resources and opportunity suggestions" />
        </section>

        <section className="mt-8 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Mentorship activity</h2>
                <p className="mt-1 text-sm text-slate-400">Review incoming requests and continue accepted conversations.</p>
              </div>
              <Link to="/mentorship-requests" className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-brand-300 hover:border-brand-400/50">Manage requests</Link>
            </div>
            {data.mentorship.recentRequests.length ? (
              <div className="mt-5 space-y-3">
                {data.mentorship.recentRequests.map((request) => (
                  <article key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <div>
                      <h3 className="font-semibold">{request.student.fullName}</h3>
                      <p className="mt-1 text-sm text-slate-400">{[request.student.branch, request.student.graduationYear && `Class of ${request.student.graduationYear}`].filter(Boolean).join(' · ')}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass[request.status]}`}>{request.status.toLowerCase()}</span>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-5 rounded-xl bg-slate-950 p-5 text-sm text-slate-400">New student mentorship requests will appear here.</p>
            )}
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
            <h2 className="text-xl font-semibold">Career events</h2>
            <p className="mt-1 text-sm text-slate-400">Volunteer for upcoming placement-office events.</p>
            {data.upcomingDrives.length ? (
              <div className="mt-5 space-y-3">
                {data.upcomingDrives.map((drive) => (
                  <article key={drive.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <h3 className="font-semibold">{drive.title}</h3>
                    <p className="mt-1 text-sm text-slate-400">{new Date(drive.date).toLocaleString()} · {drive.location}{drive.company?.name ? ` · ${drive.company.name}` : ''}</p>
                    {volunteerDriveIds.has(drive.id) ? (
                      <p className="mt-3 text-xs font-semibold text-emerald-200">Volunteer request: {data.volunteering.find((item) => item.driveId === drive.id)?.status.toLowerCase()}</p>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <input aria-label={`Volunteer note for ${drive.title}`} maxLength={1000} value={volunteerNotes[drive.id] || ''} onChange={(event) => setVolunteerNotes((current) => ({ ...current, [drive.id]: event.target.value }))} placeholder="How would you like to help?" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
                        <button type="button" onClick={() => volunteer(drive.id)} disabled={saving === drive.id} className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold hover:bg-brand-700 disabled:opacity-50">{saving === drive.id ? 'Sending...' : 'Volunteer'}</button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-5 rounded-xl bg-slate-950 p-5 text-sm text-slate-400">No upcoming career events are published right now.</p>
            )}
          </article>
        </section>

        <section className="mt-8 grid gap-5 xl:grid-cols-2">
          <form onSubmit={(event) => submitContribution(event, 'resource')} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
            <h2 className="text-xl font-semibold">Share a career resource</h2>
            <p className="mt-1 text-sm text-slate-400">Share interview advice, learning roadmaps, resume tips, or industry insights. Submissions are reviewed before students can see them.</p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm text-slate-300">Title<input required minLength={3} maxLength={160} value={resourceForm.title} onChange={(event) => setResourceForm({ ...resourceForm, title: event.target.value })} className={inputClass} /></label>
              <label className="block text-sm text-slate-300">Category<input required minLength={2} maxLength={80} value={resourceForm.category} onChange={(event) => setResourceForm({ ...resourceForm, category: event.target.value })} placeholder="Interview preparation" className={inputClass} /></label>
              <label className="block text-sm text-slate-300">Resource URL<input type="url" required maxLength={1000} value={resourceForm.url} onChange={(event) => setResourceForm({ ...resourceForm, url: event.target.value })} placeholder="https://" className={inputClass} /></label>
              <label className="block text-sm text-slate-300">Summary<textarea required minLength={10} maxLength={2000} rows={3} value={resourceForm.summary} onChange={(event) => setResourceForm({ ...resourceForm, summary: event.target.value })} className={inputClass} /></label>
            </div>
            <button disabled={saving === 'resource'} className="mt-4 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold hover:bg-brand-700 disabled:opacity-50">{saving === 'resource' ? 'Submitting...' : 'Submit for review'}</button>
          </form>

          <form onSubmit={(event) => submitContribution(event, 'opportunity')} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
            <h2 className="text-xl font-semibold">Recommend an opportunity</h2>
            <p className="mt-1 text-sm text-slate-400">Submit a job or internship lead. This is a recommendation, not a verified job posting, and requires Placement Office review.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-slate-300 sm:col-span-2">Role title<input required minLength={3} maxLength={160} value={opportunityForm.title} onChange={(event) => setOpportunityForm({ ...opportunityForm, title: event.target.value })} className={inputClass} /></label>
              <label className="text-sm text-slate-300">Company<input required minLength={2} maxLength={160} value={opportunityForm.company} onChange={(event) => setOpportunityForm({ ...opportunityForm, company: event.target.value })} className={inputClass} /></label>
              <label className="text-sm text-slate-300">Location<input required minLength={2} maxLength={160} value={opportunityForm.location} onChange={(event) => setOpportunityForm({ ...opportunityForm, location: event.target.value })} className={inputClass} /></label>
              <label className="text-sm text-slate-300">Type<select value={opportunityForm.type} onChange={(event) => setOpportunityForm({ ...opportunityForm, type: event.target.value })} className={inputClass}><option value="FULL_TIME">Full-time</option><option value="INTERNSHIP">Internship</option><option value="PART_TIME">Part-time</option><option value="CONTRACT">Contract</option></select></label>
              <label className="text-sm text-slate-300">Opportunity URL<input type="url" required maxLength={1000} value={opportunityForm.url} onChange={(event) => setOpportunityForm({ ...opportunityForm, url: event.target.value })} placeholder="https://" className={inputClass} /></label>
              <label className="text-sm text-slate-300 sm:col-span-2">Details<textarea required minLength={10} maxLength={2000} rows={3} value={opportunityForm.details} onChange={(event) => setOpportunityForm({ ...opportunityForm, details: event.target.value })} className={inputClass} /></label>
            </div>
            <button disabled={saving === 'opportunity'} className="mt-4 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold hover:bg-brand-700 disabled:opacity-50">{saving === 'opportunity' ? 'Submitting...' : 'Submit recommendation'}</button>
          </form>
        </section>

        <section className="mt-8 grid gap-5 xl:grid-cols-2">
          <ContributionList title="My shared resources" items={data.resources} />
          <ContributionList title="My opportunity recommendations" items={data.recommendations} />
        </section>

        <section className="mt-5 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
          <h2 className="text-lg font-semibold">My career event participation</h2>
          {data.volunteering.length ? (
            <ul className="mt-4 grid gap-3 md:grid-cols-2">
              {data.volunteering.map((item) => (
                <li key={item.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{item.drive.title}</p>
                      <p className="mt-1 text-sm text-slate-400">{new Date(item.drive.date).toLocaleString()} · {item.drive.location}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass[item.status]}`}>{item.status.toLowerCase()}</span>
                  </div>
                  {item.note && <p className="mt-2 text-sm text-slate-300">{item.note}</p>}
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-slate-400">Volunteer requests and approved event commitments will appear here.</p>}
        </section>

        <nav aria-label="Alumni tools" className="mt-8 flex flex-wrap gap-3 border-t border-slate-800 pt-6 text-sm">
          <Link to="/career-resources" className="rounded-lg border border-slate-700 px-4 py-2 text-brand-300 hover:border-brand-400/50">Browse approved career resources</Link>
          <Link to="/alumni" className="rounded-lg border border-slate-700 px-4 py-2 text-brand-300 hover:border-brand-400/50">Alumni directory</Link>
          <Link to="/mentorship-requests" className="rounded-lg border border-slate-700 px-4 py-2 text-brand-300 hover:border-brand-400/50">My mentees and conversations</Link>
        </nav>
      </div>
    </main>
  );
}

function OverviewCard({ label, value, detail }) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </article>
  );
}

function ContributionList({ title, items }) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {items.length ? (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4">
              <div className="min-w-0">
                <p className="font-medium">{item.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-slate-400">{item.summary || item.details}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass[item.status]}`}>{item.status.toLowerCase()}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-slate-400">Your submitted items will appear here with their review status.</p>
      )}
    </article>
  );
}
