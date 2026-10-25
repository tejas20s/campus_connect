import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function RecruiterApprovalPage() {
  const [recruiters, setRecruiters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadRecruiters() {
    const { data } = await api.get('/admin/recruiters/pending');
    setRecruiters(data.data);
  }

  useEffect(() => {
    let active = true;
    loadRecruiters()
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load pending recruiter accounts.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function reviewRecruiter(recruiterId, approved) {
    setUpdatingId(recruiterId);
    setError('');
    setMessage('');
    try {
      await api.patch(`/admin/recruiters/${recruiterId}/approval`, { approved });
      await loadRecruiters();
      setMessage(approved ? 'Recruiter account approved.' : 'Recruiter account rejected.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update recruiter approval.');
    } finally {
      setUpdatingId('');
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <Link to="/dashboard" className="text-sm font-semibold text-brand-300">← Dashboard</Link>
        <header className="my-8">
          <p className="text-sm uppercase tracking-wider text-brand-300">Placement office</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Recruiter approvals</h1>
          <p className="mt-2 text-slate-400">Review recruiter access requests before company and job management is enabled.</p>
        </header>

        {error && <p role="alert" className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">{error}</p>}
        {message && <p role="status" className="mb-5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-200">{message}</p>}

        {loading ? (
          <p role="status" className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-300">Loading requests...</p>
        ) : recruiters.length ? (
          <div className="space-y-3">
            {recruiters.map((recruiter) => (
              <article key={recruiter.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div>
                  <h2 className="font-semibold">{recruiter.email}</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {recruiter.recruiterProfile?.designation || 'Recruiter'}
                    {recruiter.recruiterProfile?.company?.name ? ` · ${recruiter.recruiterProfile.company.name}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Requested {new Date(recruiter.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" disabled={updatingId === recruiter.id} onClick={() => reviewRecruiter(recruiter.id, true)} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-60">Approve</button>
                  <button type="button" disabled={updatingId === recruiter.id} onClick={() => reviewRecruiter(recruiter.id, false)} className="rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-200 hover:bg-red-500/10 disabled:opacity-60">Reject</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 px-6 py-12 text-center">
            <h2 className="font-semibold">No pending requests</h2>
            <p className="mt-2 text-sm text-slate-400">New recruiter registrations will appear here.</p>
          </div>
        )}
      </div>
    </main>
  );
}
