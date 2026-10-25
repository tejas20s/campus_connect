import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { getJobMatch } from '../lib/jobMatching';
import LogoutButton from '../components/LogoutButton';

const prepTips = [
  'Tailor your resume to each role and quantify project outcomes wherever possible.',
  'Practice explaining your projects, decisions, and trade-offs out loud.',
  'Review core concepts for your target role and prepare thoughtful questions for interviewers.'
];

export default function StudentDashboard({ user }) {
  const [data, setData] = useState({
    profile: null,
    applications: [],
    notifications: [],
    announcements: [],
    drives: [],
    jobs: []
  });
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    let active = true;
    const resources = [
      ['profile', '/students/me'],
      ['applications', '/applications/my'],
      ['notifications', '/notifications'],
      ['announcements', '/announcements'],
      ['drives', '/placement-drives'],
      ['jobs', '/jobs?pageSize=50']
    ];
    Promise.all(resources.map(async ([key, path]) => {
      try {
        const response = await api.get(path);
        return { key, value: response.data.data };
      } catch (error) {
        return { key, error: error.response?.data?.message || `Unable to load ${key}.` };
      }
    })).then((results) => {
      if (!active) return;
      const nextData = {};
      const nextErrors = [];
      results.forEach((result) => {
        if (result.error) nextErrors.push(result.error);
        else nextData[result.key] = result.value;
      });
      setData((current) => ({ ...current, ...nextData }));
      setErrors(nextErrors);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const upcomingInterviews = useMemo(() => data.applications
    .filter((application) => application.interview?.status === 'SCHEDULED' &&
      new Date(application.interview.scheduledAt) >= new Date())
    .sort((left, right) => new Date(left.interview.scheduledAt) - new Date(right.interview.scheduledAt))
    .slice(0, 4), [data.applications]);

  const skillGaps = useMemo(() => {
    const counts = new Map();
    data.jobs.forEach((job) => {
      const match = getJobMatch(job, data.profile);
      match.missingSkills.forEach((skill) => counts.set(skill, (counts.get(skill) || 0) + 1));
    });
    return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 5).map(([skill]) => skill);
  }, [data.jobs, data.profile]);

  const unreadCount = data.notifications.filter((notification) => !notification.isRead).length;
  const profileFields = ['fullName', 'branch', 'graduationYear', 'cgpa', 'phone'];
  const completedProfileFields = profileFields.filter((field) => data.profile?.[field] != null && data.profile[field] !== '').length +
    (data.profile?.skills?.length ? 1 : 0) +
    (data.profile?.hasResume ? 1 : 0);
  const profileCompletion = data.profile ? Math.round((completedProfileFields / 7) * 100) : 0;

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <Link to="/" className="text-lg font-bold text-slate-950">Campus<span className="text-blue-600">Connect</span></Link>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/notifications" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-blue-50">Notifications{unreadCount ? ` (${unreadCount})` : ''}</Link>
            <LogoutButton className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50" />
          </div>
        </header>
        <section className="mt-6 rounded-3xl bg-[#101b36] px-6 py-8 text-white sm:px-9">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-200">Student workspace</p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Welcome back, {data.profile?.fullName || user.email}</h1>
          <p className="mt-3 max-w-2xl text-slate-300">Keep your profile current, discover opportunities that fit, and get ready for your next interview.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/jobs" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Explore matched jobs</Link>
            <Link to="/applications" className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Track applications</Link>
            <Link to="/profile" className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Edit profile</Link>
          </div>
        </section>

        {errors.length > 0 && <p role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Some dashboard information could not be loaded: {errors.join(' ')}</p>}
        {loading ? <p role="status" className="mt-6 rounded-2xl bg-white p-6 text-slate-500">Loading your placement summary...</p> : (
          <>
            <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard label="Profile ready" value={`${profileCompletion}%`} note="Add academics, skills, and a resume" />
              <SummaryCard label="Applications" value={data.applications.length} note="Track progress and feedback" />
              <SummaryCard label="Upcoming interviews" value={upcomingInterviews.length} note="Review schedules and instructions" />
              <SummaryCard label="Unread updates" value={unreadCount} note="Application and campus news" />
            </section>
            <div className="mt-7 grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <h2 className="text-xl font-bold">Upcoming interviews</h2>
                {upcomingInterviews.length ? <ul className="mt-4 space-y-3">
                  {upcomingInterviews.map((application) => <li key={application.id} className="rounded-xl bg-indigo-50 p-4">
                    <p className="font-semibold">{application.job.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{new Date(application.interview.scheduledAt).toLocaleString()} · {application.interview.mode || 'Format not specified'}</p>
                    {application.interview.venue && <p className="mt-1 break-words text-sm text-slate-600">{application.interview.venue}</p>}
                    <Link to="/applications" className="mt-2 inline-block text-sm font-semibold text-blue-700">View instructions →</Link>
                  </li>)}
                </ul> : <p className="mt-3 text-sm text-slate-500">No upcoming interviews are scheduled.</p>}
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <h2 className="text-xl font-bold">Skills to strengthen</h2>
                <p className="mt-1 text-sm text-slate-500">Common requirements missing from the open jobs shown in your match feed.</p>
                {skillGaps.length ? <div className="mt-4 flex flex-wrap gap-2">{skillGaps.map((skill) => <span key={skill} className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-800">{skill}</span>)}</div> : <p className="mt-3 text-sm text-slate-500">Complete your profile and browse jobs to see personalized skill gaps.</p>}
                <Link to="/jobs" className="mt-4 inline-block text-sm font-semibold text-blue-700">See matching opportunities →</Link>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <h2 className="text-xl font-bold">Placement updates</h2>
                <div className="mt-4 space-y-3">
                  {data.announcements.slice(0, 3).map((item) => <article key={item.id} className="rounded-xl bg-slate-50 p-4"><h3 className="font-semibold">{item.title}</h3><p className="mt-1 text-sm text-slate-600">{item.message}</p></article>)}
                  {data.drives.slice(0, 3).map((drive) => <article key={drive.id} className="rounded-xl bg-slate-50 p-4"><h3 className="font-semibold">{drive.title}</h3><p className="mt-1 text-sm text-slate-600">{drive.company?.name} · {new Date(drive.date).toLocaleString()}</p></article>)}
                  {!data.announcements.length && !data.drives.length && <p className="text-sm text-slate-500">No upcoming placement updates yet.</p>}
                </div>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <h2 className="text-xl font-bold">Interview preparation</h2>
                <ul className="mt-4 space-y-3">{prepTips.map((tip) => <li key={tip} className="flex gap-3 text-sm leading-6 text-slate-600"><span className="font-bold text-blue-600">✓</span>{tip}</li>)}</ul>
                <Link to="/career-resources" className="mt-4 inline-block text-sm font-semibold text-blue-700">Explore alumni career resources →</Link>
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function SummaryCard({ label, value, note }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{note}</p></article>;
}
