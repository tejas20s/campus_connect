import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { getJobMatch } from '../lib/jobMatching';

const jobTypes = {
  FULL_TIME: 'Full-time',
  INTERNSHIP: 'Internship',
  PART_TIME: 'Part-time',
  CONTRACT: 'Contract'
};

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export default function JobsPage() {
  const [filters, setFilters] = useState({ q: '', location: '', type: '', page: 1 });
  const [matchFilter, setMatchFilter] = useState({ eligibility: 'all', minimumSkillMatch: 0 });
  const [jobs, setJobs] = useState([]);
  const [studentProfile, setStudentProfile] = useState(null);
  const [profileLoadError, setProfileLoadError] = useState(false);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    try {
      const currentUser = JSON.parse(sessionStorage.getItem('campusconnect_user') || 'null');
      if (currentUser?.role === 'STUDENT') {
        api.get('/students/me')
          .then(({ data }) => {
            if (active) setStudentProfile(data.data);
          })
          .catch(() => {
            if (active) setProfileLoadError(true);
          });
      }
    } catch {
      setProfileLoadError(true);
    }
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    api.get('/jobs', {
      params: {
        q: filters.q || undefined,
        location: filters.location || undefined,
        type: filters.type || undefined,
        page: filters.page,
        eligibleOnly: studentProfile && matchFilter.eligibility === 'eligible' ? 'true' : undefined,
        minimumSkillMatch: studentProfile && matchFilter.minimumSkillMatch > 0 ? matchFilter.minimumSkillMatch : undefined,
        pageSize: 30
      }
    })
      .then(({ data }) => {
        if (!active) return;
        setJobs(data.data);
        setPagination(data.pagination);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load job openings.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [filters, studentProfile, matchFilter]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value, ...(key === 'page' ? {} : { page: 1 }) }));
  }

  function updateMatchFilter(key, value) {
    setMatchFilter((current) => ({ ...current, [key]: value }));
    setFilters((current) => ({ ...current, page: 1 }));
  }

  const visibleJobs = jobs;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link to="/" className="text-sm font-semibold text-brand-300">CampusConnect</Link>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Jobs and internships</h1>
            <p className="mt-2 text-slate-400">Explore open opportunities shared by campus partners.</p>
          </div>
          <nav className="flex gap-3 text-sm">
            <Link to="/applications" className="rounded-lg border border-slate-700 px-4 py-2 hover:border-slate-500">My applications</Link>
            <Link to="/login" className="rounded-lg bg-brand-500 px-4 py-2 font-medium hover:bg-brand-700">Sign in</Link>
          </nav>
        </header>

        <section aria-label="Filter job openings" className="mb-6 grid gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 md:grid-cols-[2fr_1fr_1fr]">
          <label className="text-sm text-slate-300">
            Search
            <input
              type="search"
              value={filters.q}
              onChange={(event) => updateFilter('q', event.target.value)}
              placeholder="Role, company, or keyword"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-brand-500"
            />
          </label>
          <label className="text-sm text-slate-300">
            Location
            <input
              type="search"
              value={filters.location}
              onChange={(event) => updateFilter('location', event.target.value)}
              placeholder="City or remote"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-brand-500"
            />
          </label>
          <label className="text-sm text-slate-300">
            Opportunity type
            <select
              value={filters.type}
              onChange={(event) => updateFilter('type', event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-brand-500"
            >
              <option value="">All types</option>
              {Object.entries(jobTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          {studentProfile && (
            <>
              <label className="text-sm text-slate-300">
                Eligibility
                <select value={matchFilter.eligibility} onChange={(event) => updateMatchFilter('eligibility', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white">
                  <option value="all">All jobs</option>
                  <option value="eligible">Eligible only</option>
                </select>
              </label>
              <label className="text-sm text-slate-300">
                Minimum skill match: {matchFilter.minimumSkillMatch}%
                <input aria-label="Minimum skill match" type="range" min="0" max="100" step="10" value={matchFilter.minimumSkillMatch} onChange={(event) => updateMatchFilter('minimumSkillMatch', Number(event.target.value))} className="mt-3 w-full accent-blue-500" />
              </label>
            </>
          )}
        </section>

        {error && <p role="alert" className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">{error}</p>}
        {profileLoadError && (
          <p role="status" className="mb-5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
            We couldn’t load your profile for personalized matching. You can still browse opportunities.
          </p>
        )}
        {studentProfile && (
          <p className="mb-5 rounded-xl border border-brand-400/20 bg-brand-500/5 p-4 text-sm text-slate-300">
            Match insights are based on your profile. <Link to="/profile" className="font-semibold text-brand-300 hover:text-brand-200">Update your profile</Link> to keep them accurate.
          </p>
        )}
        {loading ? (
          <p role="status" className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-300">Loading opportunities...</p>
        ) : visibleJobs.length ? (
          <>
            <p className="mb-4 text-sm text-slate-400">
              Showing {visibleJobs.length} of {pagination?.total ?? jobs.length} opportunities on this page
              {studentProfile && matchFilter.eligibility === 'eligible' ? ' · eligible only' : ''}
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {visibleJobs.map((job) => (
                <JobCard key={job.id} job={job} studentProfile={studentProfile} />
              ))}
            </div>
            {pagination?.totalPages > 1 && (
              <nav aria-label="Job listing pages" className="mt-6 flex items-center justify-between">
                <button type="button" disabled={pagination.page <= 1} onClick={() => updateFilter('page', pagination.page - 1)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm disabled:opacity-40">Previous</button>
                <span className="text-sm text-slate-400">Page {pagination.page} of {pagination.totalPages}</span>
                <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => updateFilter('page', pagination.page + 1)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm disabled:opacity-40">Next</button>
              </nav>
            )}
          </>
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 px-6 py-12 text-center">
            <h2 className="text-lg font-semibold">{jobs.length ? 'No jobs match your eligibility filters' : 'No matching opportunities'}</h2>
            <p className="mt-2 text-sm text-slate-400">Try changing your search or eligibility filters.</p>
          </div>
        )}
        {!loading && pagination?.totalPages > 1 && !visibleJobs.length && (
          <nav aria-label="Job listing pages" className="mt-6 flex items-center justify-between">
            <button type="button" disabled={pagination.page <= 1} onClick={() => updateFilter('page', pagination.page - 1)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm disabled:opacity-40">Previous</button>
            <span className="text-sm text-slate-400">Page {pagination.page} of {pagination.totalPages}</span>
            <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => updateFilter('page', pagination.page + 1)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm disabled:opacity-40">Next</button>
          </nav>
        )}
      </div>
    </main>
  );
}

function JobCard({ job, studentProfile }) {
  const match = studentProfile ? getJobMatch(job, studentProfile) : null;

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-slate-600">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-brand-300">{job.company?.name || 'Campus employer'}</p>
          <h2 className="mt-2 text-xl font-semibold">{job.title}</h2>
        </div>
        <span className="shrink-0 rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">{jobTypes[job.type] || job.type}</span>
      </div>
      {match && (
        <p className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
          match.eligible
            ? 'bg-emerald-400/10 text-emerald-200'
            : 'bg-amber-400/10 text-amber-100'
        }`}>
          {match.eligible
            ? 'Eligible based on your profile'
            : `${match.missingRequirements.length} requirement${match.missingRequirements.length === 1 ? '' : 's'} to address`}
          {match.skillMatchPercent != null
            ? ` · ${match.skillMatchPercent}% skill match`
            : ''}
        </p>
      )}
      <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-300">{job.description}</p>
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">
        <span>{job.location}</span>
        <span>Apply by {formatDate(job.deadline)}</span>
      </div>
      <Link to={`/jobs/${job.id}`} className="mt-6 inline-flex rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
        View opportunity
      </Link>
    </article>
  );
}
