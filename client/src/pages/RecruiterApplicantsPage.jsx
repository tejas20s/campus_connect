import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';

const nextStatuses = {
  APPLIED: ['UNDER_REVIEW', 'SHORTLISTED', 'REJECTED'],
  UNDER_REVIEW: ['SHORTLISTED', 'REJECTED'],
  SHORTLISTED: ['INTERVIEW_SCHEDULED', 'SELECTED', 'REJECTED'],
  INTERVIEW_SCHEDULED: ['SELECTED', 'REJECTED']
};

export default function RecruiterApplicantsPage() {
  const { jobId } = useParams();
  const [applications, setApplications] = useState([]);
  const [jobTitle, setJobTitle] = useState('');
  const [interviewForms, setInterviewForms] = useState({});
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState('');
  const [openingResumeId, setOpeningResumeId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadApplications = useCallback(async () => {
    const { data } = await api.get(`/jobs/${jobId}/applications`);
    setApplications(data.data);
    setJobTitle(data.data[0]?.job?.title || '');
  }, [jobId]);

  useEffect(() => {
    let active = true;
    loadApplications()
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load applicants.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadApplications]);

  async function openResume(studentId) {
    setOpeningResumeId(studentId);
    setError('');
    try {
      const { data } = await api.get(`/students/${studentId}/resume`);
      window.open(data.data.url, '_blank', 'noopener,noreferrer');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to open this applicant resume.');
    } finally {
      setOpeningResumeId('');
    }
  }

  async function updateStatus(application, status) {
    const schedule = interviewForms[application.id] || {};
    if (status === 'INTERVIEW_SCHEDULED' && !schedule.scheduledAt) {
      setError('Enter an interview date and time before scheduling.');
      return;
    }

    setUpdatingId(application.id);
    setError('');
    setMessage('');
    try {
      await api.patch(`/applications/${application.id}/status`, {
        status,
        feedback: schedule.feedback || undefined,
        ...(status === 'INTERVIEW_SCHEDULED' && {
          ...schedule,
          scheduledAt: new Date(schedule.scheduledAt).toISOString()
        })
      });
      await loadApplications();
      setMessage(`Application updated to ${status.replaceAll('_', ' ').toLowerCase()}.`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update this application.');
    } finally {
      setUpdatingId('');
    }
  }

  function updateInterviewForm(applicationId, field, value) {
    setInterviewForms((current) => ({
      ...current,
      [applicationId]: { ...current[applicationId], [field]: value }
    }));
  }

  if (loading) {
    return <main className="min-h-screen bg-slate-950 p-8 text-slate-300">Loading applicants...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <Link to="/recruiter/jobs" className="text-sm font-semibold text-brand-300">← Company openings</Link>
        <header className="my-8">
          <p className="text-sm uppercase tracking-wider text-brand-300">Applicant management</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{jobTitle || 'Applicants'}</h1>
          <p className="mt-2 text-slate-400">Review candidate details and update each application’s progress.</p>
        </header>

        {error && <p role="alert" className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">{error}</p>}
        {message && <p role="status" className="mb-5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-200">{message}</p>}

        {applications.length ? (
          <div className="space-y-4">
            {applications.map((application) => {
              const actions = nextStatuses[application.status] || [];
              const interviewForm = interviewForms[application.id] || {};
              return (
                <article key={application.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold">{application.student.fullName}</h2>
                      <p className="mt-1 text-sm text-slate-400">{application.student.user.email}</p>
                      <p className="mt-2 text-sm text-slate-300">
                        {[application.student.branch, application.student.graduationYear, application.student.cgpa != null ? `CGPA ${application.student.cgpa}` : null].filter(Boolean).join(' · ')}
                      </p>
                      {application.student.skills?.length > 0 && <p className="mt-2 text-sm text-slate-400">Skills: {application.student.skills.join(', ')}</p>}
                      <button type="button" onClick={() => openResume(application.student.id)} disabled={openingResumeId === application.student.id} className="mt-3 text-sm font-medium text-brand-300 hover:text-brand-200 disabled:opacity-60">
                        {openingResumeId === application.student.id ? 'Opening resume...' : 'View private resume'}
                      </button>
                    </div>
                    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200">{application.status.replaceAll('_', ' ')}</span>
                  </div>

                  {application.interview && (
                    <p className="mt-4 rounded-xl border border-indigo-400/20 bg-indigo-500/10 p-3 text-sm text-indigo-100">
                      Interview: {new Date(application.interview.scheduledAt).toLocaleString()}
                      {application.interview.venue ? ` · ${application.interview.venue}` : ''}
                    </p>
                  )}

                  {actions.includes('INTERVIEW_SCHEDULED') && (
                    <div className="mt-5 grid gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4 sm:grid-cols-2">
                      <label className="text-sm text-slate-300">
                        Interview date and time
                        <input type="datetime-local" required value={interviewForm.scheduledAt || ''} onChange={(event) => updateInterviewForm(application.id, 'scheduledAt', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-brand-500" />
                      </label>
                      <label className="text-sm text-slate-300">
                        Mode
                        <input maxLength={100} value={interviewForm.mode || ''} onChange={(event) => updateInterviewForm(application.id, 'mode', event.target.value)} placeholder="Online or in person" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-brand-500" />
                      </label>
                      <label className="text-sm text-slate-300 sm:col-span-2">
                        Venue or meeting link
                        <input maxLength={300} value={interviewForm.venue || ''} onChange={(event) => updateInterviewForm(application.id, 'venue', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-brand-500" />
                      </label>
                      <label className="text-sm text-slate-300 sm:col-span-2">
                        Candidate instructions
                        <textarea rows={2} maxLength={2000} value={interviewForm.instructions || ''} onChange={(event) => updateInterviewForm(application.id, 'instructions', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-brand-500" />
                      </label>
                    </div>
                  )}

                  {actions.length > 0 && (
                    <div className="mt-5 space-y-3">
                      <label className="block text-sm text-slate-300">
                        Feedback for the student (optional)
                        <textarea rows={2} maxLength={2000} value={interviewForm.feedback || ''} onChange={(event) => updateInterviewForm(application.id, 'feedback', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-brand-500" />
                      </label>
                      <div className="flex flex-wrap gap-2">
                      {actions.map((status) => (
                        <button
                          key={status}
                          type="button"
                          disabled={updatingId === application.id}
                          onClick={() => updateStatus(application, status)}
                          className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:border-brand-400/50 hover:text-white disabled:opacity-60"
                        >
                          {updatingId === application.id ? 'Updating...' : status === 'INTERVIEW_SCHEDULED' ? 'Schedule interview' : status.replaceAll('_', ' ')}
                        </button>
                      ))}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 px-6 py-12 text-center">
            <h2 className="font-semibold">No applicants yet</h2>
            <p className="mt-2 text-sm text-slate-400">Applications for this opening will show here.</p>
          </div>
        )}
      </div>
    </main>
  );
}
