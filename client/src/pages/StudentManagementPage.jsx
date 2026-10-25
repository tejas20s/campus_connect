import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

const initialFilters = { q: '', branch: '', graduationYear: '' };

export default function StudentManagementPage() {
  const [form, setForm] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.get('/admin/students', {
      params: {
        q: filters.q || undefined,
        branch: filters.branch || undefined,
        graduationYear: filters.graduationYear || undefined,
        page: pagination.page,
        pageSize: pagination.pageSize
      }
    })
      .then(({ data }) => {
        if (!active) return;
        setStudents(data.data);
        setPagination(data.pagination);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load the student registry.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filters, pagination.page, pagination.pageSize]);

  function submitFilters(event) {
    event.preventDefault();
    setPagination((current) => ({ ...current, page: 1 }));
    setFilters(form);
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Link to="/dashboard" className="text-sm font-semibold text-brand-300">← Dashboard</Link>
        <header className="my-8">
          <p className="text-sm uppercase tracking-wider text-brand-300">Placement office</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Student management</h1>
          <p className="mt-2 text-slate-400">Search student academic records and application totals. Private contact and uploaded files are not shown.</p>
        </header>

        {error && <p role="alert" className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">{error}</p>}

        <form onSubmit={submitFilters} className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:grid-cols-4">
          <label className="text-sm text-slate-300 sm:col-span-2">Name, email, or department
            <input value={form.q} onChange={(event) => setForm({ ...form, q: event.target.value })} maxLength={120} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
          </label>
          <label className="text-sm text-slate-300">Department
            <input value={form.branch} onChange={(event) => setForm({ ...form, branch: event.target.value })} maxLength={100} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
          </label>
          <label className="text-sm text-slate-300">Graduation year
            <input type="number" min="1980" max="2200" value={form.graduationYear} onChange={(event) => setForm({ ...form, graduationYear: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
          </label>
          <div className="flex gap-2 sm:col-span-4">
            <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold hover:bg-brand-700">Search students</button>
            <button type="button" onClick={() => { setForm(initialFilters); setFilters(initialFilters); setPagination((current) => ({ ...current, page: 1 })); }} className="rounded-lg border border-slate-700 px-4 py-2 text-sm">Clear filters</button>
          </div>
        </form>

        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-5 py-4">
            <h2 className="font-semibold">Student records</h2>
            <p className="text-sm text-slate-400">{pagination.total} students</p>
          </div>
          {loading ? (
            <p role="status" className="p-6 text-slate-300">Loading students...</p>
          ) : students.length ? (
            <div className="divide-y divide-slate-800">
              {students.map((student) => (
                <article key={student.id} className="grid gap-2 px-5 py-4 sm:grid-cols-2 lg:grid-cols-5">
                  <div><h3 className="font-semibold">{student.fullName}</h3><p className="text-sm text-slate-400">{student.user.email}</p></div>
                  <p className="text-sm text-slate-300">{student.branch || 'Department not set'}</p>
                  <p className="text-sm text-slate-300">Class of {student.graduationYear || 'Not set'}</p>
                  <p className="text-sm text-slate-300">CGPA: {student.cgpa ?? 'Not set'}</p>
                  <p className="text-sm text-slate-300">{student._count.applications} applications</p>
                  {student.skills.length > 0 && <p className="text-xs text-slate-400 sm:col-span-2 lg:col-span-5">Skills: {student.skills.join(', ')}</p>}
                </article>
              ))}
            </div>
          ) : (
            <p className="p-6 text-slate-400">No students match these filters.</p>
          )}
          <div className="flex items-center justify-between border-t border-slate-800 px-5 py-4">
            <button type="button" disabled={pagination.page <= 1 || loading} onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))} className="rounded-lg border border-slate-700 px-3 py-2 text-sm disabled:opacity-50">Previous</button>
            <p className="text-sm text-slate-400">Page {pagination.page} of {Math.max(1, pagination.totalPages)}</p>
            <button type="button" disabled={pagination.page >= pagination.totalPages || loading} onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))} className="rounded-lg border border-slate-700 px-3 py-2 text-sm disabled:opacity-50">Next</button>
          </div>
        </section>
      </div>
    </main>
  );
}
