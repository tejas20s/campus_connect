import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { getJobMatch } from '../lib/jobMatching';

const jobTypes = {
  FULL_TIME: 'Full-time',
  INTERNSHIP: 'Internship',
  PART_TIME: 'Part-time',
  CONTRACT: 'Contract'
};

function getCurrentUser() {
  try {
    const raw = sessionStorage.getItem('campusconnect_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function JobDetailsPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState('');
  const user = getCurrentUser();
  const [studentProfile, setStudentProfile] = useState(null);
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    let active = true;
    api.get(`/jobs/${jobId}`)
      .then(({ data }) => {
        if (active) setJob(data.data);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load this opportunity.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [jobId]);

  useEffect(() => {
    if (user?.role !== 'STUDENT') return undefined;
    let active = true;
    api.get('/students/me')
      .then(({ data }) => {
        if (active) setStudentProfile(data.data);
      })
      .catch((requestError) => {
        if (active) {
          setProfileError(requestError.response?.data?.message || 'Unable to load your profile for eligibility checking.');
        }
      });
    return () => {
      active = false;
    };
  }, [user?.role]);

  const jobMatch = studentProfile && job ? getJobMatch(job, studentProfile) : null;

  async function applyForJob() {
    if (!user) {
      navigate('/login', { state: { from: `/jobs/${jobId}` } });
      return;
    }
    if (user.role !== 'STUDENT') {
      setError('Only student accounts can apply for opportunities.');
      return;
    }

    setApplying(true);
    setError('');
    setMessage('');
    try {
      await api.post(`/jobs/${jobId}/applications`);
      setMessage('Application submitted. You can track its progress in My applications.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to submit your application.');
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-slate-950 p-8 text-slate-300">Loading opportunity...</main>;
  }

  if (!job) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-50">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-8">
          <p role="alert" className="text-red-200">{error || 'Opportunity not found.'}</p>
          <Link to="/jobs" className="mt-5 inline-block text-brand-300 hover:text-brand-200">Back to opportunities</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50 sm:px-6">
      <article className="mx-auto max-w-4xl rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-10">
        <Link to="/jobs" className="text-sm text-brand-300 hover:text-brand-200">← All opportunities</Link>
        <header className="mt-8 border-b border-slate-800 pb-7">
          <p className="text-sm font-medium text-brand-300">{job.company?.name}</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{job.title}</h1>
          <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-300">
            <span className="rounded-full bg-slate-800 px-3 py-1">{jobTypes[job.type] || job.type}</span>
            <span className="rounded-full bg-slate-800 px-3 py-1">{job.location}</span>
            <span className="rounded-full bg-slate-800 px-3 py-1">Deadline {new Date(job.deadline).toLocaleDateString()}</span>
          </div>
        </header>

        <section className="py-8">
          <h2 className="text-xl font-semibold">About the opportunity</h2>
          <p className="mt-4 whitespace-pre-wrap leading-7 text-slate-300">{job.description}</p>
          {job.eligibility && (
            <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950 p-5">
              <h3 className="font-semibold">Eligibility</h3>
              <dl className="mt-3 space-y-2 text-sm text-slate-300">
                {job.eligibility.branches?.length > 0 && <div><dt className="inline font-medium text-slate-100">Branches: </dt><dd className="inline">{job.eligibility.branches.join(', ')}</dd></div>}
                {job.eligibility.graduationYears?.length > 0 && <div><dt className="inline font-medium text-slate-100">Graduation years: </dt><dd className="inline">{job.eligibility.graduationYears.join(', ')}</dd></div>}
                {job.eligibility.minCgpa != null && <div><dt className="inline font-medium text-slate-100">Minimum CGPA: </dt><dd className="inline">{job.eligibility.minCgpa}</dd></div>}
                {job.eligibility.skills?.length > 0 && <div><dt className="inline font-medium text-slate-100">Required skills: </dt><dd className="inline">{job.eligibility.skills.join(', ')}</dd></div>}
              </dl>
            </div>
          )}
          {user?.role === 'STUDENT' && (
            <div className={`mt-6 rounded-2xl border p-5 ${
              jobMatch?.eligible
                ? 'border-emerald-400/30 bg-emerald-400/5'
                : 'border-amber-400/30 bg-amber-400/5'
            }`}>
              <h3 className={`font-semibold ${jobMatch?.eligible ? 'text-emerald-200' : 'text-amber-100'}`}>
                {jobMatch
                  ? (jobMatch.eligible ? 'You meet the listed requirements' : 'Profile improvements needed')
                  : profileError ? 'Unable to check your eligibility' : 'Checking your eligibility...'}
              </h3>
              {jobMatch?.missingRequirements.length > 0 && (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-300">
                  {jobMatch.missingRequirements.map((requirement) => <li key={requirement}>{requirement}</li>)}
                </ul>
              )}
              {jobMatch?.matchedSkills.length > 0 && (
                <p className="mt-3 text-sm text-slate-300">Matching skills: {jobMatch.matchedSkills.join(', ')}.</p>
              )}
              {jobMatch?.missingSkills.length > 0 && (
                <p className="mt-2 text-sm text-slate-300">
                  Recommended skills to add or develop: <span className="font-medium text-white">{jobMatch.missingSkills.join(', ')}</span>.
                </p>
              )}
              {!jobMatch && profileError && <p role="alert" className="mt-2 text-sm text-amber-100">{profileError}</p>}
              <Link to="/profile" className="mt-3 inline-block text-sm font-semibold text-brand-300 hover:text-brand-200">Review your profile</Link>
            </div>
          )}
        </section>

        {error && <p role="alert" className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        {message && <p role="status" className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</p>}
        <button
          type="button"
          onClick={applyForJob}
          disabled={applying || Boolean(message) || Boolean(jobMatch && !jobMatch.eligible)}
          className="rounded-xl bg-brand-500 px-5 py-3 font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {applying ? 'Submitting...' : message ? 'Applied' : jobMatch && !jobMatch.eligible ? 'Update your profile to apply' : 'Apply now'}
        </button>
      </article>
    </main>
  );
}
