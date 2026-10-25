import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function CareerResourcesPage() {
  const [resources, setResources] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([api.get('/career-resources'), api.get('/opportunity-recommendations')])
      .then(([resourcesResponse, opportunitiesResponse]) => {
        if (!active) return;
        setResources(resourcesResponse.data.data);
        setRecommendations(opportunitiesResponse.data.data);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load career resources.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Link to="/dashboard" className="text-sm font-semibold text-brand-300">← Dashboard</Link>
        <header className="my-7">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-300">Alumni community</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Career resources and leads</h1>
          <p className="mt-2 text-slate-400">Placement Office-approved advice and alumni-recommended opportunities.</p>
        </header>
        {error && <p role="alert" className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">{error}</p>}
        {loading ? <p role="status" className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-300">Loading community resources...</p> : (
          <div className="grid gap-6 xl:grid-cols-2">
            <ResourceSection title="Career advice and learning resources" items={resources} />
            <ResourceSection title="Opportunity recommendations" items={recommendations} opportunities />
          </div>
        )}
      </div>
    </main>
  );
}

function ResourceSection({ title, items, opportunities = false }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      {items.length ? (
        <ul className="mt-5 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-300">{opportunities ? `${item.type.replaceAll('_', ' ')} · ${item.company}` : item.category}</p>
              <h3 className="mt-2 font-semibold">{item.title}</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{item.summary || item.details}</p>
              {opportunities && <p className="mt-2 text-xs text-slate-400">{item.location} · Recommended by {item.alumni.fullName}</p>}
              <a href={item.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-semibold text-brand-300 hover:text-brand-200">Open resource ↗</a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-xl bg-slate-950 p-5 text-sm text-slate-400">Nothing has been approved for this section yet.</p>
      )}
    </section>
  );
}
