import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

const statusStyles = {
  APPLIED: 'bg-sky-500/15 text-sky-200',
  UNDER_REVIEW: 'bg-amber-500/15 text-amber-200',
  SHORTLISTED: 'bg-violet-500/15 text-violet-200',
  INTERVIEW_SCHEDULED: 'bg-indigo-500/15 text-indigo-200',
  SELECTED: 'bg-emerald-500/15 text-emerald-200',
  REJECTED: 'bg-red-500/15 text-red-200',
  WITHDRAWN: 'bg-slate-700 text-slate-300'
};

export default function ApplicationsPage() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [withdrawing, setWithdrawing] = useState('');

  useEffect(() => {
    let active = true;
    api.get('/applications/my')
      .then(({ data }) => {
        if (active) setApplications(data.data);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load your applications.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function withdraw(applicationId) {
    setWithdrawing(applicationId);
    setError('');
    try {
      const { data } = await api.post(`/applications/${applicationId}/withdraw`);
      setApplications((current) => current.map((application) => (
        application.id === applicationId ? { ...application, ...data.data } : application
      )));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to withdraw this application.');
    } finally {
      setWithdrawing('');
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <Link to="/jobs" className="text-sm font-semibold text-brand-300">← Browse opportunities</Link>
        <header className="my-8">
          <h1 className="text-3xl font-bold sm:text-4xl">My applications</h1>
          <p className="mt-2 text-slate-400">Follow each application and interview update here.</p>
        </header>

        {error && <p role="alert" className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">{error}</p>}
        {loading ? (
          <p role="status" className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-300">Loading applications...</p>
        ) : applications.length ? (
          <div className="space-y-4">
            {applications.map((application) => (
              <article key={application.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-brand-300">{application.job.company?.name}</p>
                    <h2 className="mt-1 text-xl font-semibold">{application.job.title}</h2>
                    <p className="mt-2 text-sm text-slate-400">Applied {new Date(application.appliedAt).toLocaleDateString()}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[application.status] || 'bg-slate-700 text-slate-300'}`}>
                    {application.status.replaceAll('_', ' ')}
                  </span>
                </div>
                {application.interview && (
                  <div className="mt-5 rounded-xl border border-indigo-400/20 bg-indigo-500/10 p-4 text-sm">
                    <p className="font-semibold text-indigo-100">Interview {application.interview.status?.toLowerCase() || 'scheduled'}</p>
                    <p className="mt-1 text-indigo-100/80">{new Date(application.interview.scheduledAt).toLocaleString()}</p>
                    {application.interview.mode && <p className="mt-1 text-indigo-100/80">Format: {application.interview.mode}</p>}
                    {application.interview.venue && <p className="mt-1 text-indigo-100/80">{application.interview.venue}</p>}
                    {application.interview.instructions && <p className="mt-2 text-indigo-100/80">{application.interview.instructions}</p>}
                  </div>
                )}
                <section className="mt-5 border-t border-slate-800 pt-4">
                  <h3 className="text-sm font-semibold text-slate-200">Application timeline</h3>
                  <ol className="mt-3 space-y-3">
                    {(application.statusHistory?.length ? application.statusHistory : [{
                      id: `current-${application.id}`,
                      status: application.status,
                      createdAt: application.updatedAt || application.appliedAt
                    }]).map((event) => (
                      <li key={event.id} className="flex gap-3 text-sm">
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-400" />
                        <div>
                          <p className="font-medium text-slate-200">{event.status.replaceAll('_', ' ')}</p>
                          <p className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</p>
                          {event.feedback && <p className="mt-1 whitespace-pre-wrap text-slate-300">Recruiter feedback: {event.feedback}</p>}
                        </div>
                      </li>
                    ))}
                  </ol>
                  {!application.statusHistory?.length && (
                    <p className="mt-3 text-xs text-slate-500">Earlier status transitions were not recorded before timeline tracking was enabled.</p>
                  )}
                </section>
                {!['SELECTED', 'REJECTED', 'WITHDRAWN'].includes(application.status) && (
                  <button
                    type="button"
                    onClick={() => withdraw(application.id)}
                    disabled={withdrawing === application.id}
                    className="mt-5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-red-400/50 hover:text-red-200 disabled:opacity-60"
                  >
                    {withdrawing === application.id ? 'Withdrawing...' : 'Withdraw application'}
                  </button>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 px-6 py-12 text-center">
            <h2 className="text-lg font-semibold">No applications yet</h2>
            <p className="mt-2 text-sm text-slate-400">Your submitted applications will appear here.</p>
            <Link to="/jobs" className="mt-5 inline-flex rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold">Explore jobs</Link>
          </div>
        )}
      </div>
    </main>
  );
}
