import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

const initialFilters = { q: '', department: '', company: '', skill: '', graduationYear: '' };

export default function AlumniDirectoryPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [profiles, setProfiles] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.get('/alumni', {
      params: {
        ...Object.fromEntries(Object.entries(filters).map(([key, value]) => [key, value || undefined])),
        page,
        pageSize: 12
      }
    })
      .then(({ data }) => {
        if (!active) return;
        setProfiles(data.data);
        setPagination(data.pagination);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load the alumni directory.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filters, page]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link to="/" className="text-sm font-semibold text-brand-300">CampusConnect</Link>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Alumni directory</h1>
            <p className="mt-2 text-slate-400">Find graduates by name, department, experience, or skill.</p>
          </div>
          <nav className="flex flex-wrap gap-3 text-sm">
            <Link to="/mentorship-requests" className="rounded-lg border border-slate-700 px-4 py-2 hover:border-slate-500">Mentorship requests</Link>
            <Link to="/alumni/me" className="rounded-lg bg-brand-500 px-4 py-2 font-medium hover:bg-brand-700">My alumni profile</Link>
          </nav>
        </header>

        <section aria-label="Filter alumni" className="mb-6 grid gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['q', 'Search', 'Name, role, company, or bio'],
            ['department', 'Department', 'Department or program'],
            ['company', 'Company', 'Current company'],
            ['skill', 'Skill', 'Exact skill'],
            ['graduationYear', 'Graduation year', 'e.g. 2020']
          ].map(([key, label, placeholder]) => (
            <label key={key} className="text-sm text-slate-300">
              {label}
              <input
                type={key === 'graduationYear' ? 'number' : 'search'}
                min={key === 'graduationYear' ? 1980 : undefined}
                max={key === 'graduationYear' ? 2200 : undefined}
                value={filters[key]}
                onChange={(event) => updateFilter(key, event.target.value)}
                placeholder={placeholder}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-brand-500"
              />
            </label>
          ))}
          <button
            type="button"
            onClick={() => { setFilters(initialFilters); setPage(1); }}
            className="self-end rounded-lg border border-slate-700 px-4 py-2 text-sm hover:border-slate-500"
          >
            Clear filters
          </button>
        </section>

        {error && <p role="alert" className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">{error}</p>}
        {loading ? (
          <p role="status" className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-300">Loading alumni...</p>
        ) : profiles.length ? (
          <>
            <p className="mb-4 text-sm text-slate-400">{pagination?.total ?? profiles.length} public profiles</p>
            <div className="grid gap-4 md:grid-cols-2">
              {profiles.map((profile) => (
                <article key={profile.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-slate-600">
                  <p className="text-sm font-medium text-brand-300">{[profile.jobTitle, profile.currentCompany].filter(Boolean).join(' · ') || 'Alumni'}</p>
                  <h2 className="mt-2 text-xl font-semibold">{profile.fullName}</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {[profile.department, profile.graduationYear && `Class of ${profile.graduationYear}`].filter(Boolean).join(' · ') || 'Department not listed'}
                  </p>
                  {profile.bio && <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-300">{profile.bio}</p>}
                  {profile.skills?.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {profile.skills.slice(0, 8).map((skill) => (
                        <span key={skill} className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">{skill}</span>
                      ))}
                    </div>
                  )}
                  <Link to={`/alumni/${profile.id}`} className="mt-6 inline-flex rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                    View profile
                  </Link>
                </article>
              ))}
            </div>
            {pagination?.totalPages > 1 && (
              <nav aria-label="Alumni directory pages" className="mt-7 flex items-center justify-center gap-4">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-400">Page {page} of {pagination.totalPages}</span>
                <button
                  type="button"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((current) => current + 1)}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </nav>
            )}
          </>
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 px-6 py-12 text-center">
            <h2 className="text-lg font-semibold">No alumni match those filters</h2>
            <p className="mt-2 text-sm text-slate-400">Try a broader search or clear some filters.</p>
          </div>
        )}
      </div>
    </main>
  );
}
