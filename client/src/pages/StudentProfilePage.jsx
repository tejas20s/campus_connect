import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

const emptyProfile = {
  fullName: '',
  branch: '',
  graduationYear: '',
  cgpa: '',
  phone: '',
  skills: '',
  portfolioLinks: []
};

export default function StudentProfilePage() {
  const [profile, setProfile] = useState(emptyProfile);
  const [hasResume, setHasResume] = useState(false);
  const [resumeFile, setResumeFile] = useState(null);
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    api.get('/students/me')
      .then(async ({ data }) => {
        if (!active) return;
        const student = data.data;
        setProfile({
          fullName: student.fullName || '',
          branch: student.branch || '',
          graduationYear: student.graduationYear?.toString() || '',
          cgpa: student.cgpa?.toString() || '',
          phone: student.phone || '',
          skills: (student.skills || []).join(', '),
          portfolioLinks: Object.entries(student.portfolioLinks || {}).map(([label, url]) => ({ label, url }))
        });
        setHasResume(student.hasResume);
        if (student.hasProfileImage) {
          const imageResponse = await api.get('/students/me/profile-image');
          if (active) setProfileImageUrl(imageResponse.data.data.url);
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load your profile.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const { data } = await api.patch('/students/me', {
        fullName: profile.fullName,
        branch: profile.branch || null,
        graduationYear: profile.graduationYear ? Number(profile.graduationYear) : null,
        cgpa: profile.cgpa ? Number(profile.cgpa) : null,
        phone: profile.phone || null,
        skills: profile.skills.split(',').map((skill) => skill.trim()).filter(Boolean),
        portfolioLinks: Object.fromEntries(
          profile.portfolioLinks
            .map(({ label, url }) => [label.trim(), url.trim()])
            .filter(([label, url]) => label && url)
        )
      });
      setHasResume(data.data.hasResume);
      setMessage('Profile saved.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save your profile.');
    } finally {
      setSaving(false);
    }
  }

  async function uploadResume(event) {
    event.preventDefault();
    if (!resumeFile) {
      setError('Choose a PDF file before uploading.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    const formData = new FormData();
    formData.append('file', resumeFile);
    try {
      await api.post('/students/me/resume', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setHasResume(true);
      setResumeFile(null);
      event.currentTarget.reset();
      setMessage('Resume uploaded privately.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to upload your resume.');
    } finally {
      setSaving(false);
    }
  }

  async function openResume() {
    setError('');
    try {
      const { data } = await api.get('/students/me/resume');
      window.open(data.data.url, '_blank', 'noopener,noreferrer');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to open your resume.');
    }
  }

  async function uploadProfileImage(event) {
    event.preventDefault();
    if (!profileImageFile) {
      setError('Choose a JPEG or PNG image before uploading.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    const formData = new FormData();
    formData.append('file', profileImageFile);
    try {
      await api.post('/students/me/profile-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const { data } = await api.get('/students/me/profile-image');
      setProfileImageUrl(data.data.url);
      setProfileImageFile(null);
      event.currentTarget.reset();
      setMessage('Profile image updated.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to upload your profile image.');
    } finally {
      setSaving(false);
    }
  }

  function updatePortfolioLink(index, field, value) {
    setProfile((current) => ({
      ...current,
      portfolioLinks: current.portfolioLinks.map((link, linkIndex) => (
        linkIndex === index ? { ...link, [field]: value } : link
      ))
    }));
  }

  if (loading) {
    return <main className="min-h-screen bg-slate-950 p-8 text-slate-300">Loading profile...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <Link to="/dashboard" className="text-sm font-semibold text-brand-300">← Dashboard</Link>
        <header className="my-8">
          <p className="text-sm uppercase tracking-wider text-brand-300">Student account</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Your profile</h1>
          <p className="mt-2 text-slate-400">Keep your academic and career information current.</p>
        </header>

        {error && <p role="alert" className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">{error}</p>}
        {message && <p role="status" className="mb-5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-200">{message}</p>}

        <section className="mb-6 flex flex-wrap items-center gap-5 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          {profileImageUrl ? (
            <img src={profileImageUrl} alt="Your profile" className="h-20 w-20 rounded-full border border-slate-700 object-cover" />
          ) : (
            <div aria-label="No profile image" className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-800 text-2xl font-semibold text-slate-300">
              {profile.fullName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <form onSubmit={uploadProfileImage} className="flex min-w-0 flex-1 flex-wrap items-end gap-3">
            <label className="min-w-0 flex-1 text-sm text-slate-300">
              Profile image (JPEG or PNG, up to 5 MB)
              <input type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" onChange={(event) => setProfileImageFile(event.target.files?.[0] || null)} className="mt-2 block w-full text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-700 file:px-4 file:py-2 file:text-white" />
            </label>
            <button disabled={saving || !profileImageFile} className="rounded-lg border border-slate-700 px-4 py-2 font-semibold hover:border-slate-500 disabled:opacity-50">{saving ? 'Uploading...' : profileImageUrl ? 'Replace image' : 'Upload image'}</button>
          </form>
        </section>

        <form onSubmit={saveProfile} className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-slate-300">
              Full name
              <input required minLength={2} maxLength={120} value={profile.fullName} onChange={(event) => setProfile({ ...profile, fullName: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-brand-500" />
            </label>
            <label className="text-sm text-slate-300">
              Branch / department
              <input maxLength={100} value={profile.branch} onChange={(event) => setProfile({ ...profile, branch: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-brand-500" />
            </label>
            <label className="text-sm text-slate-300">
              Graduation year
              <input type="number" min="1980" max="2200" value={profile.graduationYear} onChange={(event) => setProfile({ ...profile, graduationYear: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-brand-500" />
            </label>
            <label className="text-sm text-slate-300">
              CGPA (0–10)
              <input type="number" min="0" max="10" step="0.01" value={profile.cgpa} onChange={(event) => setProfile({ ...profile, cgpa: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-brand-500" />
            </label>
            <label className="text-sm text-slate-300">
              Phone (only visible to you)
              <input type="tel" maxLength={40} value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-brand-500" />
            </label>
            <label className="text-sm text-slate-300">
              Skills (comma-separated)
              <input maxLength={1000} value={profile.skills} onChange={(event) => setProfile({ ...profile, skills: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-brand-500" />
            </label>
            <fieldset className="space-y-3 sm:col-span-2">
              <legend className="text-sm text-slate-300">Portfolio links</legend>
              {profile.portfolioLinks.map((link, index) => (
                <div key={`portfolio-link-${index}`} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
                  <label className="text-xs text-slate-400">
                    Link label
                    <input maxLength={80} value={link.label} onChange={(event) => updatePortfolioLink(index, 'label', event.target.value)} placeholder="Portfolio" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-brand-500" />
                  </label>
                  <label className="text-xs text-slate-400">
                    URL
                    <input type="url" maxLength={500} value={link.url} onChange={(event) => updatePortfolioLink(index, 'url', event.target.value)} placeholder="https://example.com" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-brand-500" />
                  </label>
                  <button type="button" onClick={() => setProfile((current) => ({
                    ...current,
                    portfolioLinks: current.portfolioLinks.filter((_, linkIndex) => linkIndex !== index)
                  }))} className="self-end rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-red-400/50 hover:text-red-200">
                    Remove
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setProfile((current) => ({
                ...current,
                portfolioLinks: [...current.portfolioLinks, { label: '', url: '' }]
              }))} className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-brand-300 hover:border-brand-400/50">
                Add portfolio link
              </button>
              <p className="text-xs text-slate-500">Incomplete rows are ignored when you save.</p>
            </fieldset>
          </div>
          <button disabled={saving} className="mt-5 rounded-lg bg-brand-500 px-4 py-2 font-semibold hover:bg-brand-700 disabled:opacity-60">{saving ? 'Saving...' : 'Save profile'}</button>
        </form>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold">Resume</h2>
          <p className="mt-2 text-sm text-slate-400">PDF only, up to 5 MB. Stored as a private file. Recruiters can access it only for applications to their company.</p>
          <form onSubmit={uploadResume} className="mt-4 flex flex-wrap items-end gap-3">
            <label className="min-w-0 flex-1 text-sm text-slate-300">
              Upload or replace PDF resume
              <input type="file" accept="application/pdf,.pdf" onChange={(event) => setResumeFile(event.target.files?.[0] || null)} className="mt-2 block w-full text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-700 file:px-4 file:py-2 file:text-white" />
            </label>
            <button disabled={saving || !resumeFile} className="rounded-lg border border-slate-700 px-4 py-2 font-semibold hover:border-slate-500 disabled:opacity-50">{saving ? 'Uploading...' : hasResume ? 'Replace resume' : 'Upload resume'}</button>
          </form>
          {hasResume && (
            <button type="button" onClick={openResume} className="mt-4 text-sm font-medium text-brand-300 hover:text-brand-200">Open my current resume</button>
          )}
        </section>
      </div>
    </main>
  );
}
