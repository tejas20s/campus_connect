import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      const response = await api.post('/auth/login', form);
      const { token, user } = response.data;

      if (!token || !user) {
        throw new Error('Login response was incomplete.');
      }

      sessionStorage.setItem('campusconnect_token', token);
      sessionStorage.setItem('campusconnect_user', JSON.stringify(user));
      setMessage('Login successful. Redirecting...');

      setTimeout(() => navigate(location.state?.from || '/dashboard'), 500);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to sign in.');
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7f9fc] px-4 py-10 text-slate-900">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-cyan-100/80 blur-3xl" />
      <div className="relative w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-3 text-lg font-bold tracking-tight text-slate-900">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-xl text-white shadow-lg shadow-blue-600/20">C</span>
          <span>Campus<span className="text-blue-600">Connect</span></span>
        </Link>
        <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-[0_24px_70px_-32px_rgba(15,23,42,0.28)] sm:p-9">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Your campus career portal</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Welcome back</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Sign in to continue to your CampusConnect workspace.</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}

          <button type="submit" className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700">
            Sign in to CampusConnect
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          No account yet? <Link to="/register" className="font-semibold text-blue-700 hover:text-blue-800">Create one</Link>
        </p>
        </div>
      </div>
    </div>
  );
}
