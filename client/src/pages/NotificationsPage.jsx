import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.get('/notifications')
      .then(({ data }) => {
        if (active) setNotifications(data.data);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load notifications.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function markAsRead(id) {
    setError('');
    try {
      const { data } = await api.patch(`/notifications/${id}/read`);
      setNotifications((current) => current.map((notification) => (
        notification.id === id ? data.data : notification
      )));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update this notification.');
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <Link to="/dashboard" className="text-sm font-semibold text-brand-300">← Dashboard</Link>
        <header className="my-8">
          <h1 className="text-3xl font-bold sm:text-4xl">Notifications</h1>
          <p className="mt-2 text-slate-400">Updates about your CampusConnect activity.</p>
        </header>
        {error && <p role="alert" className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">{error}</p>}
        {loading ? (
          <p role="status" className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-300">Loading notifications...</p>
        ) : notifications.length ? (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <article key={notification.id} className={`rounded-xl border bg-slate-900 p-5 ${notification.isRead ? 'border-slate-800' : 'border-brand-500/40'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{notification.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{notification.message}</p>
                    <p className="mt-2 text-xs text-slate-500">{new Date(notification.createdAt).toLocaleString()}</p>
                  </div>
                  {!notification.isRead && (
                    <button type="button" onClick={() => markAsRead(notification.id)} className="text-sm font-medium text-brand-300 hover:text-brand-200">Mark as read</button>
                  )}
                </div>
                {notification.link && <Link to={notification.link} className="mt-3 inline-flex text-sm text-brand-300 hover:text-brand-200">Open related page →</Link>}
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-10 text-center text-slate-400">You don’t have any notifications yet.</div>
        )}
      </div>
    </main>
  );
}
