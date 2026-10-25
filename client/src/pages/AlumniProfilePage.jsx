import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';

function getStoredUser() {
  try {
    const raw = sessionStorage.getItem('campusconnect_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function toForm(profile) {
  return {
    fullName: profile.fullName || '',
    graduationYear: profile.graduationYear ?? '',
    department: profile.department || '',
    currentCompany: profile.currentCompany || '',
    jobTitle: profile.jobTitle || '',
    skills: (profile.skills || []).join(', '),
    mentoringTopics: (profile.mentoringTopics || []).join(', '),
    professionalExperience: profile.professionalExperience || '',
    bio: profile.bio || '',
    linkedinUrl: profile.linkedinUrl || '',
    website: profile.website || '',
    isPublic: profile.isPublic ?? true
  };
}

export default function AlumniProfilePage() {
  const { alumniId } = useParams();
  const user = getStoredUser();
  const ownProfile = alumniId === 'me' && user?.role === 'ALUMNI';
  const endpoint = ownProfile ? '/alumni/me' : `/alumni/${alumniId}`;
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.get(endpoint)
      .then(({ data }) => {
        if (!active) return;
        setProfile(data.data);
        if (ownProfile) setForm(toForm(data.data));
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load this alumni profile.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [endpoint, ownProfile]);

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        fullName: form.fullName,
        graduationYear: form.graduationYear === '' ? null : Number(form.graduationYear),
        department: form.department.trim() || null,
        currentCompany: form.currentCompany.trim() || null,
        jobTitle: form.jobTitle.trim() || null,
        skills: form.skills.split(',').map((skill) => skill.trim()).filter(Boolean),
        mentoringTopics: form.mentoringTopics.split(',').map((topic) => topic.trim()).filter(Boolean),
        professionalExperience: form.professionalExperience.trim() || null,
        bio: form.bio.trim() || null,
        linkedinUrl: form.linkedinUrl.trim() || null,
        website: form.website.trim() || null,
        isPublic: form.isPublic
      };
      const { data } = await api.patch('/alumni/me', payload);
      setProfile(data.data);
      setForm(toForm(data.data));
      setMessage('Your profile was saved.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save your profile.');
    } finally {
      setSaving(false);
    }
  }

  async function sendMentorshipRequest(event) {
    event.preventDefault();
    setSendingRequest(true);
    setError('');
    setMessage('');
    try {
      await api.post('/mentorship-requests', { alumniId: profile.id, message: requestMessage });
      setRequestMessage('');
      setMessage('Your mentorship request was sent.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to send your mentorship request.');
    } finally {
      setSendingRequest(false);
    }
  }

  const inputClass = 'mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-brand-500';

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <Link to="/alumni" className="text-sm font-semibold text-brand-300">← Alumni directory</Link>
        <div className="mt-6 flex flex-wrap justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold sm:text-4xl">{ownProfile ? 'My alumni profile' : 'Alumni profile'}</h1>
            <p className="mt-2 text-slate-400">
              {ownProfile ? 'Keep your experience current and choose whether your profile appears publicly.' : 'Connect with graduates and learn about their experience.'}
            </p>
          </div>
          <Link to="/mentorship-requests" className="self-start rounded-lg border border-slate-700 px-4 py-2 text-sm hover:border-slate-500">Mentorship requests</Link>
        </div>

        {error && <p role="alert" className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">{error}</p>}
        {message && <p role="status" className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">{message}</p>}
        {loading ? (
          <p role="status" className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-300">Loading profile...</p>
        ) : profile ? ownProfile ? (
          <form onSubmit={saveProfile} className="mt-6 space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-slate-300">Full name
                <input required minLength={2} maxLength={120} value={form.fullName} onChange={(event) => updateForm('fullName', event.target.value)} className={inputClass} />
              </label>
              <label className="text-sm text-slate-300">Graduation year
                <input type="number" min="1980" max="2200" value={form.graduationYear} onChange={(event) => updateForm('graduationYear', event.target.value)} className={inputClass} />
              </label>
              <label className="text-sm text-slate-300">Department
                <input maxLength={100} value={form.department} onChange={(event) => updateForm('department', event.target.value)} className={inputClass} />
              </label>
              <label className="text-sm text-slate-300">Current company
                <input maxLength={120} value={form.currentCompany} onChange={(event) => updateForm('currentCompany', event.target.value)} className={inputClass} />
              </label>
              <label className="text-sm text-slate-300">Job title
                <input maxLength={120} value={form.jobTitle} onChange={(event) => updateForm('jobTitle', event.target.value)} className={inputClass} />
              </label>
              <label className="text-sm text-slate-300">Skills (comma-separated)
                <input maxLength={1000} value={form.skills} onChange={(event) => updateForm('skills', event.target.value)} className={inputClass} />
              </label>
              <label className="text-sm text-slate-300">Mentoring topics (comma-separated)
                <input maxLength={2000} value={form.mentoringTopics} onChange={(event) => updateForm('mentoringTopics', event.target.value)} placeholder="Interview preparation, DevOps, career transitions" className={inputClass} />
              </label>
              <label className="text-sm text-slate-300 sm:col-span-2">Professional experience and education
                <textarea rows={4} maxLength={5000} value={form.professionalExperience} onChange={(event) => updateForm('professionalExperience', event.target.value)} placeholder="Share relevant roles, projects, certifications, or further study." className={inputClass} />
              </label>
              <label className="text-sm text-slate-300 sm:col-span-2">About
                <textarea rows={5} maxLength={2000} value={form.bio} onChange={(event) => updateForm('bio', event.target.value)} className={inputClass} />
              </label>
              <label className="text-sm text-slate-300">LinkedIn URL
                <input type="url" value={form.linkedinUrl} onChange={(event) => updateForm('linkedinUrl', event.target.value)} className={inputClass} />
              </label>
              <label className="text-sm text-slate-300">Website URL
                <input type="url" value={form.website} onChange={(event) => updateForm('website', event.target.value)} className={inputClass} />
              </label>
            </div>
            <label className="flex items-center gap-3 text-sm text-slate-300">
              <input type="checkbox" checked={form.isPublic} onChange={(event) => updateForm('isPublic', event.target.checked)} className="h-4 w-4 accent-brand-500" />
              Show my profile in the public alumni directory
            </label>
            <button type="submit" disabled={saving} className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              {saving ? 'Saving...' : 'Save profile'}
            </button>
          </form>
        ) : (
          <article className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
            <p className="text-sm font-medium text-brand-300">{[profile.jobTitle, profile.currentCompany].filter(Boolean).join(' · ') || 'Alumni'}</p>
            <h2 className="mt-2 text-2xl font-bold">{profile.fullName}</h2>
            <p className="mt-2 text-slate-400">
              {[profile.department, profile.graduationYear && `Class of ${profile.graduationYear}`].filter(Boolean).join(' · ') || 'Department not listed'}
            </p>
            {profile.isVerified && <span className="mt-3 inline-flex rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">Placement Office verified</span>}
            {profile.bio && <p className="mt-6 whitespace-pre-wrap leading-7 text-slate-300">{profile.bio}</p>}
            {profile.professionalExperience && (
              <section className="mt-6">
                <h3 className="text-sm font-semibold text-slate-200">Professional experience</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{profile.professionalExperience}</p>
              </section>
            )}
            {profile.skills?.length > 0 && (
              <section className="mt-6">
                <h3 className="text-sm font-semibold text-slate-200">Skills</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.skills.map((skill) => <span key={skill} className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">{skill}</span>)}
                </div>
              </section>
            )}
            {profile.mentoringTopics?.length > 0 && (
              <section className="mt-6">
                <h3 className="text-sm font-semibold text-slate-200">Topics I can mentor</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.mentoringTopics.map((topic) => <span key={topic} className="rounded-full bg-indigo-500/15 px-3 py-1 text-xs text-indigo-200">{topic}</span>)}
                </div>
              </section>
            )}
            {(profile.linkedinUrl || profile.website) && (
              <div className="mt-6 flex flex-wrap gap-4 text-sm text-brand-300">
                {profile.linkedinUrl && <a href={profile.linkedinUrl} target="_blank" rel="noreferrer">LinkedIn profile ↗</a>}
                {profile.website && <a href={profile.website} target="_blank" rel="noreferrer">Website ↗</a>}
              </div>
            )}
            {user?.role === 'STUDENT' && (
              <form onSubmit={sendMentorshipRequest} className="mt-8 border-t border-slate-800 pt-6">
                <h3 className="text-lg font-semibold">Request mentorship</h3>
                <p className="mt-1 text-sm text-slate-400">Introduce yourself and share what guidance you’re looking for.</p>
                <label className="mt-4 block text-sm text-slate-300">Message
                  <textarea
                    required
                    minLength={10}
                    maxLength={2000}
                    rows={4}
                    value={requestMessage}
                    onChange={(event) => setRequestMessage(event.target.value)}
                    className={inputClass}
                    placeholder="Tell this alum what you hope to learn..."
                  />
                </label>
                <button type="submit" disabled={sendingRequest} className="mt-4 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                  {sendingRequest ? 'Sending...' : 'Send mentorship request'}
                </button>
              </form>
            )}
          </article>
        ) : null}
      </div>
    </main>
  );
}
