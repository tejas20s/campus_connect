import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

function getStoredUser() {
  try {
    const raw = sessionStorage.getItem('campusconnect_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const statusStyle = {
  PENDING: 'bg-amber-500/15 text-amber-200',
  ACCEPTED: 'bg-emerald-500/15 text-emerald-200',
  DECLINED: 'bg-slate-700 text-slate-300'
};

export default function MentorshipRequestsPage() {
  const user = getStoredUser();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState('');

  useEffect(() => {
    let active = true;
    api.get('/mentorship-requests')
      .then(({ data }) => {
        if (active) setRequests(data.data);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load mentorship requests.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function decide(requestId, status) {
    setUpdatingId(requestId);
    setError('');
    try {
      const { data } = await api.patch(`/mentorship-requests/${requestId}`, { status });
      setRequests((current) => current.map((request) => (
        request.id === requestId ? { ...request, ...data.data } : request
      )));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update this mentorship request.');
    } finally {
      setUpdatingId('');
    }
  }

  const isAlumni = user?.role === 'ALUMNI';

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link to="/alumni" className="text-sm font-semibold text-brand-300">← Alumni directory</Link>
            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Mentorship requests</h1>
            <p className="mt-2 text-slate-400">
              {isAlumni ? 'Review requests from students and respond to pending conversations.' : 'Track the requests you have sent to alumni.'}
            </p>
          </div>
          {isAlumni && <Link to="/alumni/me" className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:border-slate-500">Edit my profile</Link>}
        </header>

        {error && <p role="alert" className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">{error}</p>}
        {loading ? (
          <p role="status" className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-300">Loading mentorship requests...</p>
        ) : requests.length ? (
          <div className="space-y-4">
            {requests.map((request) => {
              const person = isAlumni ? request.student : request.alumni;
              const subtitle = isAlumni
                ? [person?.branch, person?.graduationYear && `Class of ${person.graduationYear}`].filter(Boolean).join(' · ')
                : [person?.jobTitle, person?.currentCompany].filter(Boolean).join(' · ');
              return (
                <article key={request.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-brand-300">{isAlumni ? 'From student' : 'To alumni'}</p>
                      <h2 className="mt-1 text-xl font-semibold">{person?.fullName || (isAlumni ? 'Student' : 'Alumni')}</h2>
                      {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle[request.status] || 'bg-slate-700 text-slate-300'}`}>
                      {request.status.toLowerCase()}
                    </span>
                  </div>
                  <p className="mt-5 whitespace-pre-wrap rounded-xl bg-slate-950 p-4 text-sm leading-6 text-slate-300">{request.message}</p>
                  <p className="mt-3 text-xs text-slate-500">Sent {new Date(request.createdAt).toLocaleString()}</p>
                  {isAlumni && request.status === 'PENDING' && (
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => decide(request.id, 'ACCEPTED')}
                        disabled={updatingId === request.id}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                      >
                        {updatingId === request.id ? 'Updating...' : 'Accept'}
                      </button>
                      <button
                        type="button"
                        onClick={() => decide(request.id, 'DECLINED')}
                        disabled={updatingId === request.id}
                        className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:border-red-400/50 hover:text-red-200 disabled:opacity-60"
                      >
                        {updatingId === request.id ? 'Updating...' : 'Decline'}
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 px-6 py-12 text-center">
            <h2 className="text-lg font-semibold">No mentorship requests yet</h2>
            <p className="mt-2 text-sm text-slate-400">
              {isAlumni ? 'New student requests will appear here.' : 'Requests you send will appear here with their current status.'}
            </p>
            {!isAlumni && <Link to="/alumni" className="mt-5 inline-flex rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold hover:bg-brand-700">Browse alumni</Link>}
          </div>
        )}
      </div>
    </main>
  );
}
