import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { api } from '../lib/api';

const PlacementCharts = lazy(() => import('../components/PlacementCharts'));
const emptyMetrics = {
  students: 0,
  alumni: 0,
  approvedRecruiters: 0,
  publishedJobs: 0,
  applications: 0,
  shortlisted: 0,
  selectedApplications: 0,
  placedStudents: 0,
  placementRate: 0
};

const announcementDefaults = { title: '', message: '', type: 'PLACEMENT' };
const driveDefaults = { title: '', companyId: '', date: '', location: '', description: '' };

function toDateTimeInput(value) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function PlacementAnalyticsPage() {
  const [filters, setFilters] = useState({ from: '', to: '', graduationYear: '', department: '' });
  const [metrics, setMetrics] = useState(emptyMetrics);
  const [charts, setCharts] = useState({ byDepartment: [], byGraduationYear: [], byCompany: [] });
  const [announcements, setAnnouncements] = useState([]);
  const [drives, setDrives] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [announcementForm, setAnnouncementForm] = useState(announcementDefaults);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState('');
  const [editingAnnouncementForm, setEditingAnnouncementForm] = useState(announcementDefaults);
  const [driveForm, setDriveForm] = useState(driveDefaults);
  const [editingDriveId, setEditingDriveId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadData = useCallback(async () => {
    const params = {
      from: filters.from ? new Date(filters.from).toISOString() : undefined,
      to: filters.to ? new Date(filters.to).toISOString() : undefined,
      graduationYear: filters.graduationYear || undefined,
      department: filters.department || undefined
    };
    const [overviewResponse, placementsResponse, announcementsResponse, drivesResponse, companiesResponse] = await Promise.all([
      api.get('/analytics/overview', { params }),
      api.get('/analytics/placements', { params }),
      api.get('/announcements'),
      api.get('/placement-drives/manage'),
      api.get('/companies')
    ]);
    setMetrics(overviewResponse.data.data);
    setCharts(placementsResponse.data.data);
    setAnnouncements(announcementsResponse.data.data);
    setDrives(drivesResponse.data.data);
    setCompanies(companiesResponse.data.data);
  }, [filters]);

  useEffect(() => {
    let active = true;
    loadData()
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load placement reports.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadData]);

  async function createAnnouncement(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.post('/announcements', announcementForm);
      setAnnouncementForm(announcementDefaults);
      await loadData();
      setMessage('Announcement published.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to publish announcement.');
    } finally {
      setSaving(false);
    }
  }

  async function updateAnnouncement(id, archive) {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      if (archive) await api.delete(`/announcements/${id}`);
      else await api.patch(`/announcements/${id}`, { isPublished: false });
      await loadData();
      setMessage(archive ? 'Announcement archived.' : 'Announcement unpublished.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update announcement.');
    } finally {
      setSaving(false);
    }
  }

  function startEditingAnnouncement(item) {
    setEditingAnnouncementId(item.id);
    setEditingAnnouncementForm({ title: item.title, message: item.message, type: item.type });
  }

  async function saveAnnouncement(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.patch(`/announcements/${editingAnnouncementId}`, editingAnnouncementForm);
      setEditingAnnouncementId('');
      await loadData();
      setMessage('Announcement updated.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update announcement.');
    } finally {
      setSaving(false);
    }
  }

  async function createDrive(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        ...driveForm,
        companyId: driveForm.companyId || null,
        date: new Date(driveForm.date).toISOString()
      };
      if (editingDriveId) {
        await api.patch(`/placement-drives/${editingDriveId}`, payload);
      } else {
        await api.post('/placement-drives', payload);
      }
      setDriveForm(driveDefaults);
      setEditingDriveId('');
      await loadData();
      setMessage(editingDriveId ? 'Placement drive updated.' : 'Placement drive created.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to create placement drive.');
    } finally {
      setSaving(false);
    }
  }

  function startEditingDrive(drive) {
    setEditingDriveId(drive.id);
    setDriveForm({
      title: drive.title,
      companyId: drive.companyId || '',
      date: toDateTimeInput(drive.date),
      location: drive.location,
      description: drive.description || ''
    });
  }

  async function archiveDrive(id) {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.delete(`/placement-drives/${id}`);
      await loadData();
      setMessage('Placement drive archived.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to archive placement drive.');
    } finally {
      setSaving(false);
    }
  }

  async function exportCsv() {
    setError('');
    try {
      const params = {
        from: filters.from ? new Date(filters.from).toISOString() : undefined,
        to: filters.to ? new Date(filters.to).toISOString() : undefined,
        graduationYear: filters.graduationYear || undefined,
        department: filters.department || undefined
      };
      const response = await api.get('/analytics/export.csv', { params, responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'campusconnect-placement-report.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to export the placement report.');
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-slate-950 p-8 text-slate-300">Loading placement analytics...</main>;
  }

  const cards = [
    ['Students', metrics.students],
    ['Alumni', metrics.alumni],
    ['Approved recruiters', metrics.approvedRecruiters],
    ['Published jobs', metrics.publishedJobs],
    ['Applications', metrics.applications],
    ['Shortlisted', metrics.shortlisted],
    ['Selected applications', metrics.selectedApplications],
    ['Placed students', metrics.placedStudents],
    ['Placement rate', `${metrics.placementRate}%`]
  ];

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <Link to="/dashboard" className="text-sm font-semibold text-brand-300">← Dashboard</Link>
        <header className="my-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wider text-brand-300">Placement office</p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Placement analytics</h1>
            <p className="mt-2 text-slate-400">Live metrics calculated from CampusConnect records.</p>
          </div>
          <button type="button" onClick={exportCsv} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold hover:border-brand-400">Export selected placements CSV</button>
        </header>

        {error && <p role="alert" className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">{error}</p>}
        {message && <p role="status" className="mb-5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-200">{message}</p>}

        <section aria-label="Analytics filters" className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm text-slate-300">From<input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" /></label>
          <label className="text-sm text-slate-300">To<input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" /></label>
          <label className="text-sm text-slate-300">Graduation year<input type="number" min="1980" max="2200" value={filters.graduationYear} onChange={(event) => setFilters({ ...filters, graduationYear: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" /></label>
          <label className="text-sm text-slate-300">Department<input value={filters.department} onChange={(event) => setFilters({ ...filters, department: event.target.value })} placeholder="e.g. Computer Science" className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" /></label>
        </section>

        <section aria-label="Placement metrics" className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {cards.map(([label, value]) => (
            <article key={label} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">{label}</p>
              <p className="mt-2 text-3xl font-bold text-white">{value}</p>
            </article>
          ))}
        </section>

        <section className="mt-6 grid gap-5 xl:grid-cols-2">
          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="font-semibold">Selected students by department</h2>
            <Suspense fallback={<p role="status" className="py-16 text-center text-sm text-slate-400">Loading chart...</p>}>
              <PlacementCharts mode="department" data={charts.byDepartment} />
            </Suspense>
          </article>
          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="font-semibold">Selected students by graduation year</h2>
            <Suspense fallback={<p role="status" className="py-16 text-center text-sm text-slate-400">Loading chart...</p>}>
              <PlacementCharts mode="graduationYear" data={charts.byGraduationYear} />
            </Suspense>
          </article>
          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5 xl:col-span-2">
            <h2 className="font-semibold">Company participation among selected students</h2>
            <Suspense fallback={<p role="status" className="py-16 text-center text-sm text-slate-400">Loading chart...</p>}>
              <PlacementCharts mode="company" data={charts.byCompany} />
            </Suspense>
          </article>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          <div>
            <form onSubmit={createAnnouncement} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="text-lg font-semibold">Publish an announcement</h2>
              <div className="mt-4 space-y-3">
                <label className="block text-sm text-slate-300">Title<input required minLength={3} maxLength={160} value={announcementForm.title} onChange={(event) => setAnnouncementForm({ ...announcementForm, title: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" /></label>
                <label className="block text-sm text-slate-300">Type<select value={announcementForm.type} onChange={(event) => setAnnouncementForm({ ...announcementForm, type: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"><option value="PLACEMENT">Placement</option><option value="GENERAL">General</option><option value="EVENT">Event</option><option value="URGENT">Urgent</option></select></label>
                <label className="block text-sm text-slate-300">Message<textarea required minLength={5} maxLength={10000} rows={3} value={announcementForm.message} onChange={(event) => setAnnouncementForm({ ...announcementForm, message: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" /></label>
              </div>
              <button disabled={saving} className="mt-4 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold hover:bg-brand-700 disabled:opacity-50">Publish announcement</button>
            </form>
            <div className="mt-4 space-y-3">
              {announcements.map((item) => (
                <article key={item.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  {editingAnnouncementId === item.id ? (
                    <form onSubmit={saveAnnouncement} className="space-y-3">
                      <label className="block text-sm text-slate-300">Title<input required minLength={3} maxLength={160} value={editingAnnouncementForm.title} onChange={(event) => setEditingAnnouncementForm({ ...editingAnnouncementForm, title: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" /></label>
                      <label className="block text-sm text-slate-300">Type<select value={editingAnnouncementForm.type} onChange={(event) => setEditingAnnouncementForm({ ...editingAnnouncementForm, type: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"><option value="PLACEMENT">Placement</option><option value="GENERAL">General</option><option value="EVENT">Event</option><option value="URGENT">Urgent</option></select></label>
                      <label className="block text-sm text-slate-300">Message<textarea required minLength={5} maxLength={10000} rows={3} value={editingAnnouncementForm.message} onChange={(event) => setEditingAnnouncementForm({ ...editingAnnouncementForm, message: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" /></label>
                      <div className="flex gap-2"><button disabled={saving} className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold disabled:opacity-50">Save changes</button><button type="button" onClick={() => setEditingAnnouncementId('')} className="rounded-lg border border-slate-700 px-3 py-2 text-sm">Cancel</button></div>
                    </form>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="text-xs text-brand-300">{item.type}</p><h3 className="mt-1 font-semibold">{item.title}</h3><p className="mt-2 text-sm text-slate-300">{item.message}</p></div>
                      <div className="flex shrink-0 gap-3"><button type="button" onClick={() => startEditingAnnouncement(item)} className="text-xs text-brand-300 hover:text-brand-200">Edit</button><button type="button" disabled={saving} onClick={() => updateAnnouncement(item.id, true)} className="text-xs text-red-200 hover:text-red-100 disabled:opacity-50">Archive</button></div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>

          <div>
            <form onSubmit={createDrive} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="text-lg font-semibold">{editingDriveId ? 'Edit placement drive' : 'Schedule a placement drive'}</h2>
              <div className="mt-4 space-y-3">
                <label className="block text-sm text-slate-300">Title<input required minLength={3} maxLength={160} value={driveForm.title} onChange={(event) => setDriveForm({ ...driveForm, title: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" /></label>
                <label className="block text-sm text-slate-300">Company<select value={driveForm.companyId} onChange={(event) => setDriveForm({ ...driveForm, companyId: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"><option value="">No company specified</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
                <label className="block text-sm text-slate-300">Date and time<input type="datetime-local" required value={driveForm.date} onChange={(event) => setDriveForm({ ...driveForm, date: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" /></label>
                <label className="block text-sm text-slate-300">Location<input required minLength={2} maxLength={160} value={driveForm.location} onChange={(event) => setDriveForm({ ...driveForm, location: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" /></label>
                <label className="block text-sm text-slate-300">Details<textarea rows={2} maxLength={5000} value={driveForm.description} onChange={(event) => setDriveForm({ ...driveForm, description: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" /></label>
              </div>
              <div className="mt-4 flex gap-2">
                <button disabled={saving} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold hover:bg-brand-700 disabled:opacity-50">{editingDriveId ? 'Save changes' : 'Create drive'}</button>
                {editingDriveId && <button type="button" onClick={() => { setEditingDriveId(''); setDriveForm(driveDefaults); }} className="rounded-lg border border-slate-700 px-4 py-2 text-sm">Cancel</button>}
              </div>
            </form>
            <div className="mt-4 space-y-3">
              {drives.map((drive) => (
                <article key={drive.id} className="flex items-start justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <div><h3 className="font-semibold">{drive.title}</h3><p className="mt-1 text-sm text-slate-400">{drive.company?.name || 'Campus drive'} · {drive.location}</p><p className="mt-1 text-xs text-slate-500">{new Date(drive.date).toLocaleString()}</p></div>
                  <div className="flex shrink-0 gap-3">
                    <button type="button" disabled={saving} onClick={() => startEditingDrive(drive)} className="text-xs text-brand-300 hover:text-brand-200 disabled:opacity-50">Edit</button>
                    <button type="button" disabled={saving} onClick={() => archiveDrive(drive.id)} className="text-xs text-red-200 hover:text-red-100 disabled:opacity-50">Archive</button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
