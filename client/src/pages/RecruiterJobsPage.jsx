import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

const initialCompany = { name: '', industry: '', website: '', location: '', description: '' };
const initialJob = { title: '', description: '', location: '', type: 'FULL_TIME', deadline: '', salaryMin: '', salaryMax: '' };

export default function RecruiterJobsPage() {
  const [company, setCompany] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [companyForm, setCompanyForm] = useState(initialCompany);
  const [jobForm, setJobForm] = useState(initialJob);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadDashboard = useCallback(async () => {
    const [companyResponse, jobsResponse] = await Promise.all([
      api.get('/companies/mine'),
      api.get('/jobs/mine')
    ]);
    setCompany(companyResponse.data.data);
    setJobs(jobsResponse.data.data);
  }, []);

  useEffect(() => {
    let active = true;
    loadDashboard()
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load recruiter workspace.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadDashboard]);

  async function createCompany(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const { data } = await api.post('/companies', companyForm);
      setCompany(data.data);
      setCompanyForm(initialCompany);
      setMessage('Company profile created.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save company details.');
    } finally {
      setSaving(false);
    }
  }

  async function createJob(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.post('/jobs', {
        ...jobForm,
        deadline: new Date(jobForm.deadline).toISOString(),
        salaryMin: jobForm.salaryMin ? Number(jobForm.salaryMin) : null,
        salaryMax: jobForm.salaryMax ? Number(jobForm.salaryMax) : null
      });
      setJobForm(initialJob);
      await loadDashboard();
      setMessage('Job saved as a draft. Publish it when it is ready.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to create job opening.');
    } finally {
      setSaving(false);
    }
  }

  async function updateJob(jobId, updates) {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      if (updates.archive) {
        await api.delete(`/jobs/${jobId}`);
      } else {
        await api.patch(`/jobs/${jobId}`, updates);
      }
      await loadDashboard();
      setMessage(updates.archive ? 'Job archived.' : 'Job updated.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update this job.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-slate-950 p-8 text-slate-300">Loading recruiter workspace...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <Link to="/dashboard" className="text-sm font-semibold text-brand-300">← Dashboard</Link>
        <header className="my-7">
          <p className="text-sm uppercase tracking-wider text-brand-300">Recruiter workspace</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Company and job openings</h1>
          <p className="mt-2 text-slate-400">Create opportunities and review how many candidates have applied.</p>
        </header>

        {error && <p role="alert" className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">{error}</p>}
        {message && <p role="status" className="mb-5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-200">{message}</p>}

        {!company ? (
          <form onSubmit={createCompany} className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">Set up your company</h2>
            <p className="mt-2 text-sm text-slate-400">Add the company associated with your approved recruiter account.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-slate-300">
                Company name
                <input required minLength={2} maxLength={120} value={companyForm.name} onChange={(event) => setCompanyForm({ ...companyForm, name: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-brand-500" />
              </label>
              <label className="text-sm text-slate-300">
                Industry
                <input maxLength={100} value={companyForm.industry} onChange={(event) => setCompanyForm({ ...companyForm, industry: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-brand-500" />
              </label>
              <label className="text-sm text-slate-300">
                Website
                <input type="url" value={companyForm.website} onChange={(event) => setCompanyForm({ ...companyForm, website: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-brand-500" />
              </label>
              <label className="text-sm text-slate-300">
                Location
                <input maxLength={120} value={companyForm.location} onChange={(event) => setCompanyForm({ ...companyForm, location: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-brand-500" />
              </label>
              <label className="text-sm text-slate-300 sm:col-span-2">
                About the company
                <textarea rows={3} maxLength={4000} value={companyForm.description} onChange={(event) => setCompanyForm({ ...companyForm, description: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-brand-500" />
              </label>
            </div>
            <button disabled={saving} className="mt-5 rounded-lg bg-brand-500 px-4 py-2 font-semibold hover:bg-brand-700 disabled:opacity-60">{saving ? 'Saving...' : 'Create company profile'}</button>
          </form>
        ) : (
          <>
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <p className="text-sm text-brand-300">Company profile</p>
              <h2 className="mt-1 text-2xl font-semibold">{company.name}</h2>
              <p className="mt-2 text-sm text-slate-400">{[company.industry, company.location].filter(Boolean).join(' · ') || 'Add further company details through placement-office support.'}</p>
            </section>

            <form onSubmit={createJob} className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-semibold">Create a job opening</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="text-sm text-slate-300">
                  Role title
                  <input required minLength={3} maxLength={120} value={jobForm.title} onChange={(event) => setJobForm({ ...jobForm, title: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-brand-500" />
                </label>
                <label className="text-sm text-slate-300">
                  Location
                  <input required minLength={2} maxLength={120} value={jobForm.location} onChange={(event) => setJobForm({ ...jobForm, location: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-brand-500" />
                </label>
                <label className="text-sm text-slate-300">
                  Type
                  <select value={jobForm.type} onChange={(event) => setJobForm({ ...jobForm, type: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-brand-500">
                    <option value="FULL_TIME">Full-time</option>
                    <option value="INTERNSHIP">Internship</option>
                    <option value="PART_TIME">Part-time</option>
                    <option value="CONTRACT">Contract</option>
                  </select>
                </label>
                <label className="text-sm text-slate-300">
                  Application deadline
                  <input type="datetime-local" required value={jobForm.deadline} onChange={(event) => setJobForm({ ...jobForm, deadline: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-brand-500" />
                </label>
                <label className="text-sm text-slate-300">
                  Minimum salary / stipend
                  <input type="number" min="0" value={jobForm.salaryMin} onChange={(event) => setJobForm({ ...jobForm, salaryMin: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-brand-500" />
                </label>
                <label className="text-sm text-slate-300">
                  Maximum salary / stipend
                  <input type="number" min="0" value={jobForm.salaryMax} onChange={(event) => setJobForm({ ...jobForm, salaryMax: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-brand-500" />
                </label>
                <label className="text-sm text-slate-300 sm:col-span-2">
                  Description
                  <textarea required minLength={20} maxLength={12000} rows={5} value={jobForm.description} onChange={(event) => setJobForm({ ...jobForm, description: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-brand-500" />
                </label>
              </div>
              <button disabled={saving} className="mt-5 rounded-lg bg-brand-500 px-4 py-2 font-semibold hover:bg-brand-700 disabled:opacity-60">{saving ? 'Saving...' : 'Save as draft'}</button>
            </form>
          </>
        )}

        <section className="mt-8">
          <h2 className="mb-4 text-xl font-semibold">Your openings</h2>
          {jobs.length ? (
            <div className="space-y-3">
              {jobs.map((job) => (
                <article key={job.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900 p-5">
                  <div>
                    <h3 className="font-semibold">{job.title}</h3>
                    <p className="mt-1 text-sm text-slate-400">{job.location} · {job._count?.applications ?? 0} applications · {job.isArchived ? 'Archived' : job.isPublished ? 'Published' : 'Draft'}</p>
                  </div>
                  {!job.isArchived && (
                    <div className="flex gap-2">
                      <Link to={`/recruiter/jobs/${job.id}/applications`} className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-slate-500">Applicants</Link>
                      <button type="button" disabled={saving} onClick={() => updateJob(job.id, { isPublished: !job.isPublished })} className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-slate-500 disabled:opacity-60">
                        {job.isPublished ? 'Unpublish' : 'Publish'}
                      </button>
                      <button type="button" disabled={saving} onClick={() => updateJob(job.id, { archive: true })} className="rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-200 hover:bg-red-500/10 disabled:opacity-60">Archive</button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-400">No openings yet. Create a draft above to get started.</p>
          )}
        </section>
      </div>
    </main>
  );
}
