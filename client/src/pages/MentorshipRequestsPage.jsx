import { useCallback, useEffect, useState } from 'react';
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
                  {request.status === 'ACCEPTED' && (
                    <MentorshipConversation requestId={request.id} />
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

function MentorshipConversation({ requestId }) {
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const loadMessages = useCallback(async () => {
    const { data } = await api.get(`/mentorship-requests/${requestId}/messages`);
    setMessages(data.data);
  }, [requestId]);

  useEffect(() => {
    let active = true;
    loadMessages()
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load this conversation.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadMessages]);

  async function sendMessage(event) {
    event.preventDefault();
    setSending(true);
    setError('');
    try {
      await api.post(`/mentorship-requests/${requestId}/messages`, { content });
      setContent('');
      await loadMessages();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to send your message.');
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="mt-5 border-t border-slate-800 pt-4">
      <h3 className="font-semibold">Guidance conversation</h3>
      {error && <p role="alert" className="mt-3 text-sm text-red-200">{error}</p>}
      {loading ? <p className="mt-3 text-sm text-slate-400">Loading conversation...</p> : messages.length ? (
        <ol className="mt-3 max-h-72 space-y-2 overflow-y-auto">
          {messages.map((item) => (
            <li key={item.id} className="rounded-lg bg-slate-950 p-3">
              <p className="text-xs font-medium text-brand-300">{item.author.alumniProfile?.fullName || item.author.studentProfile?.fullName || 'Mentorship participant'} · {new Date(item.createdAt).toLocaleString()}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-200">{item.content}</p>
            </li>
          ))}
        </ol>
      ) : <p className="mt-3 text-sm text-slate-400">Share interview preparation tips, learning guidance, or a next step to get started.</p>}
      <form onSubmit={sendMessage} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor={`message-${requestId}`}>Send a guidance message</label>
        <textarea id={`message-${requestId}`} required maxLength={4000} rows={2} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Write a career guidance message..." className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
        <button disabled={sending || !content.trim()} className="self-end rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold hover:bg-brand-700 disabled:opacity-50">{sending ? 'Sending...' : 'Send'}</button>
      </form>
    </section>
  );
}
