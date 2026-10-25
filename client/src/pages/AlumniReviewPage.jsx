import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function AlumniReviewPage() {
  const [review, setReview] = useState({ profiles: [], resources: [], recommendations: [], volunteers: [] });
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadReview = useCallback(async () => {
    const { data } = await api.get('/admin/alumni/review');
    setReview(data.data);
  }, []);

  useEffect(() => {
    let active = true;
    loadReview()
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load alumni review queue.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadReview]);

  async function reviewItem(id, endpoint, status) {
    setSavingId(id);
    setError('');
    setMessage('');
    try {
      await api.patch(endpoint, { status });
      await loadReview();
      setMessage(`Item ${status.toLowerCase()}.`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to review this item.');
    } finally {
      setSavingId('');
    }
  }

  async function verifyProfile(profile) {
    setSavingId(profile.id);
    setError('');
    setMessage('');
    try {
      await api.patch(`/admin/alumni/${profile.id}/verify`, { verified: true });
      await loadReview();
      setMessage(`${profile.fullName}'s profile verified.`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update alumni verification.');
    } finally {
      setSavingId('');
    }
  }

  if (loading) return <main className="min-h-screen bg-slate-950 p-8 text-slate-300">Loading alumni review queue...</main>;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Link to="/admin/analytics" className="text-sm font-semibold text-brand-300">← Placement Office</Link>
        <header className="my-7">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-300">Placement Office</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Alumni participation review</h1>
          <p className="mt-2 text-slate-400">Verify alumni and review shared resources, opportunity leads, and event volunteer requests.</p>
        </header>
        {error && <p role="alert" className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">{error}</p>}
        {message && <p role="status" className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">{message}</p>}
        <div className="space-y-6">
          <ReviewSection title="Alumni profiles awaiting verification" empty="No alumni profiles need verification." items={review.profiles}>
            {(profile) => (
              <ReviewCard key={profile.id} title={profile.fullName} subtitle={[profile.jobTitle, profile.currentCompany, profile.department, profile.graduationYear].filter(Boolean).join(' · ') || 'Professional details not provided'}>
                <button type="button" disabled={savingId === profile.id} onClick={() => verifyProfile(profile)} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50">{savingId === profile.id ? 'Updating...' : 'Verify profile'}</button>
              </ReviewCard>
            )}
          </ReviewSection>
          <ReviewSection title="Career resources awaiting approval" empty="No career resources awaiting review." items={review.resources}>
            {(resource) => (
              <ReviewCard key={resource.id} title={resource.title} subtitle={`${resource.category} · shared by ${resource.alumni.fullName}`} details={resource.summary} url={resource.url}>
                <ReviewActions disabled={savingId === resource.id} onApprove={() => reviewItem(resource.id, `/admin/alumni/resources/${resource.id}/review`, 'APPROVED')} onReject={() => reviewItem(resource.id, `/admin/alumni/resources/${resource.id}/review`, 'REJECTED')} />
              </ReviewCard>
            )}
          </ReviewSection>
          <ReviewSection title="Opportunity recommendations awaiting approval" empty="No opportunity recommendations awaiting review." items={review.recommendations}>
            {(recommendation) => (
              <ReviewCard key={recommendation.id} title={`${recommendation.title} · ${recommendation.company}`} subtitle={`${recommendation.type.replaceAll('_', ' ')} · ${recommendation.location} · shared by ${recommendation.alumni.fullName}`} details={recommendation.details} url={recommendation.url}>
                <ReviewActions disabled={savingId === recommendation.id} onApprove={() => reviewItem(recommendation.id, `/admin/alumni/opportunities/${recommendation.id}/review`, 'APPROVED')} onReject={() => reviewItem(recommendation.id, `/admin/alumni/opportunities/${recommendation.id}/review`, 'REJECTED')} />
              </ReviewCard>
            )}
          </ReviewSection>
          <ReviewSection title="Career event volunteer requests" empty="No event volunteer requests awaiting review." items={review.volunteers}>
            {(volunteer) => (
              <ReviewCard key={volunteer.id} title={`${volunteer.alumni.fullName} · ${volunteer.drive.title}`} subtitle={`${new Date(volunteer.drive.date).toLocaleString()} · ${volunteer.drive.location} · ${volunteer.alumni.jobTitle || volunteer.alumni.currentCompany || 'Alumni volunteer'}`} details={volunteer.note}>
                <ReviewActions disabled={savingId === volunteer.id} onApprove={() => reviewItem(volunteer.id, `/admin/alumni/volunteers/${volunteer.id}/review`, 'APPROVED')} onReject={() => reviewItem(volunteer.id, `/admin/alumni/volunteers/${volunteer.id}/review`, 'REJECTED')} />
              </ReviewCard>
            )}
          </ReviewSection>
        </div>
      </div>
    </main>
  );
}

function ReviewSection({ title, empty, items, children }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">{items.length} pending</span>
      </div>
      {items.length ? <div className="mt-4 space-y-3">{items.map(children)}</div> : <p className="mt-4 rounded-xl bg-slate-950 p-4 text-sm text-slate-400">{empty}</p>}
    </section>
  );
}

function ReviewCard({ title, subtitle, details, url, children }) {
  return (
    <article className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        {details && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{details}</p>}
        {url && <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-block break-all text-sm text-brand-300">Review submitted link ↗</a>}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">{children}</div>
    </article>
  );
}

function ReviewActions({ disabled, onApprove, onReject }) {
  return (
    <>
      <button type="button" disabled={disabled} onClick={onApprove} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50">Approve</button>
      <button type="button" disabled={disabled} onClick={onReject} className="rounded-lg border border-rose-400/40 px-3 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-400/10 disabled:opacity-50">Reject</button>
    </>
  );
}
