import { useState } from 'react';
import { Link } from 'react-router-dom';

const features = [
  {
    number: '01',
    icon: 'briefcase',
    title: 'Opportunities that fit',
    description: 'Discover verified roles with clear eligibility, deadlines, and company details—all in one searchable place.'
  },
  {
    number: '02',
    icon: 'chart',
    title: 'A clearer path to placement',
    description: 'Follow every application from submission to interview, with timely updates for students and recruiters.'
  },
  {
    number: '03',
    icon: 'people',
    title: 'Guidance that stays connected',
    description: 'Bring alumni experience into the student journey with professional profiles and direct mentorship requests.'
  }
];

const roles = [
  { icon: 'graduation', title: 'Students', detail: 'Build a career profile, find eligible roles, and track every application.', color: 'blue' },
  { icon: 'building', title: 'Recruiters', detail: 'Create a company presence, publish openings, and coordinate interviews.', color: 'violet' },
  { icon: 'chart', title: 'Placement office', detail: 'Review recruiters, coordinate drives, and explore placement reports.', color: 'cyan' },
  { icon: 'people', title: 'Alumni', detail: 'Share professional experience and support the next generation.', color: 'amber' }
];

const iconPaths = {
  briefcase: <><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></>,
  chart: <><path d="M4 19V5M4 19h17" /><path d="m7 15 4-4 3 2 6-7" /><path d="M16 6h4v4" /></>,
  people: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-1a6 6 0 0 1 12 0v1z" /><path d="M16 5.5a3 3 0 0 1 0 5.8M18 14a5 5 0 0 1 3 4.5v1.5" /></>,
  graduation: <><path d="m2 10 10-5 10 5-10 5z" /><path d="M6 12v5c3.3 2.5 8.7 2.5 12 0v-5M22 10v6" /></>,
  building: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 21v-4h6v4M8 7h2m4 0h2M8 11h2m4 0h2" /></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>
};

function Icon({ name, className = 'h-5 w-5' }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {iconPaths[name]}
    </svg>
  );
}

function Brand({ inverse = false }) {
  return (
    <Link to="/" aria-label="CampusConnect home" className={`inline-flex items-center gap-3 ${inverse ? 'text-white' : 'text-slate-950'}`}>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-950/20">
        <Icon name="graduation" className="h-6 w-6" />
      </span>
      <span className="text-lg font-bold tracking-tight">Campus<span className={inverse ? 'text-blue-300' : 'text-blue-600'}>Connect</span></span>
    </Link>
  );
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="landing-page min-h-screen overflow-hidden bg-[#f7f9fc] text-slate-900">
      <header className="relative z-20 mx-auto max-w-7xl px-5 pt-5 sm:px-8 lg:px-10">
        <nav aria-label="Main navigation" className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-xl sm:px-6">
          <Brand />
          <div className="hidden items-center gap-8 md:flex">
            <a className="landing-nav-link" href="#features">Platform</a>
            <a className="landing-nav-link" href="#roles">Who it’s for</a>
            <a className="landing-nav-link" href="#how-it-works">How it works</a>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <Link to="/login" className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">Sign in</Link>
            <Link to="/register" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700">
              Get started <Icon name="arrow" className="h-4 w-4" />
            </Link>
          </div>
          <button
            type="button"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 md:hidden"
          >
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>
        </nav>
        {menuOpen && (
          <div className="absolute inset-x-5 top-[76px] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl md:hidden">
            <a onClick={closeMenu} className="block rounded-lg px-3 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50" href="#features">Platform</a>
            <a onClick={closeMenu} className="block rounded-lg px-3 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50" href="#roles">Who it’s for</a>
            <a onClick={closeMenu} className="block rounded-lg px-3 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50" href="#how-it-works">How it works</a>
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
              <Link onClick={closeMenu} to="/login" className="rounded-lg px-3 py-2.5 text-center text-sm font-semibold text-slate-700">Sign in</Link>
              <Link onClick={closeMenu} to="/register" className="rounded-lg bg-blue-600 px-3 py-2.5 text-center text-sm font-semibold text-white">Get started</Link>
            </div>
          </div>
        )}
      </header>

      <main>
        <section className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-16 sm:px-8 sm:pt-20 md:grid-cols-[1.05fr_0.95fr] md:pb-28 md:pt-24 lg:gap-20 lg:px-10">
          <div className="pointer-events-none absolute -left-48 top-12 h-96 w-96 rounded-full bg-blue-200/40 blur-3xl" />
          <div className="relative z-10">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-blue-700 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              The campus-to-career platform
            </div>
            <h1 className="max-w-2xl text-5xl font-bold leading-[1.06] tracking-[-0.045em] text-slate-950 sm:text-6xl lg:text-[4.35rem]">
              Bring every career journey <span className="landing-heading-accent">together.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              One connected space for students, recruiters, alumni, and placement teams to turn opportunity into measurable progress.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link to="/register" className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-700">
                Explore CampusConnect <Icon name="arrow" className="h-5 w-5" />
              </Link>
              <Link to="/jobs" className="inline-flex min-h-[52px] items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3.5 font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50">
                Browse opportunities
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-600">
              <span className="inline-flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Icon name="check" className="h-3.5 w-3.5" /></span>Built for four campus roles</span>
              <span className="inline-flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Icon name="check" className="h-3.5 w-3.5" /></span>One transparent workflow</span>
            </div>
          </div>

          <div id="analytics" className="relative mx-auto w-full max-w-xl scroll-mt-8">
            <div className="absolute -right-5 -top-6 h-28 w-28 rounded-3xl bg-cyan-200/70" />
            <div className="absolute -bottom-6 -left-7 h-32 w-32 rounded-full bg-blue-200/70" />
            <div className="relative rounded-[2rem] border border-slate-200 bg-white p-3 shadow-[0_30px_90px_-35px_rgba(15,23,42,0.28)]">
              <div className="rounded-[1.5rem] bg-[#101b36] p-5 text-white sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-blue-200">Placement overview</p>
                    <p className="mt-1 text-xs text-slate-400">Sample analytics preview</p>
                  </div>
                  <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">Dashboard</span>
                </div>
                <div className="mt-8 grid grid-cols-[1fr_auto] items-end gap-5">
                  <div>
                    <p className="text-xs text-slate-400">Placement rate</p>
                    <p className="mt-1 text-5xl font-semibold tracking-tight">82<span className="text-3xl text-blue-300">%</span></p>
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                      <Icon name="chart" className="h-3.5 w-3.5" /> Trend indicator
                    </div>
                  </div>
                  <div aria-label="Illustrative placement trend chart" className="flex h-28 items-end gap-2 pb-1">
                    {[38, 52, 46, 68, 60, 83, 74, 100].map((height, index) => (
                      <span key={index} className={`w-3 rounded-t-md ${index === 7 ? 'bg-cyan-300' : 'bg-blue-500/70'}`} style={{ height: `${height}%` }} />
                    ))}
                  </div>
                </div>
                <div className="mt-7 border-t border-white/10 pt-5">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-medium">Application pipeline</p>
                    <span className="text-xs text-slate-400">Live workflow</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[['Applications', '128', 'bg-blue-400'], ['Interviews', '42', 'bg-violet-400'], ['Offers', '18', 'bg-emerald-400']].map(([label, value, color]) => (
                      <div key={label} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                        <span className={`mb-3 block h-1 w-7 rounded-full ${color}`} />
                        <p className="text-xl font-semibold">{value}</p>
                        <p className="mt-0.5 text-[11px] text-slate-400">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-8 right-5 hidden rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-xl sm:block">
              <p className="text-xs font-medium text-slate-500">One connected ecosystem</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">Students · Recruiters · Alumni</p>
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-8 border-y border-slate-200 bg-white py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">One platform, end to end</p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Designed around the whole career journey.</h2>
              <p className="mt-4 leading-7 text-slate-600">Replace disconnected processes with clear, shared steps—from the first profile to the final placement report.</p>
            </div>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {features.map((feature) => (
                <article key={feature.number} className="group rounded-2xl border border-slate-200 bg-[#fbfcff] p-6 transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-950/5 sm:p-7">
                  <div className="flex items-center justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icon name={feature.icon} className="h-6 w-6" /></span>
                    <span className="text-sm font-semibold tracking-widest text-slate-300">{feature.number}</span>
                  </div>
                  <h3 className="mt-6 text-lg font-bold text-slate-950">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{feature.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="roles" className="scroll-mt-8 py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div className="max-w-xl">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Made for your campus</p>
                <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Everyone has a place in the process.</h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-slate-600">Purpose-built spaces bring each stakeholder the tools they need while keeping the entire placement journey connected.</p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {roles.map((role) => (
                <article key={role.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-lg">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${role.color === 'blue' ? 'bg-blue-50 text-blue-700' : role.color === 'violet' ? 'bg-violet-50 text-violet-700' : role.color === 'cyan' ? 'bg-cyan-50 text-cyan-700' : 'bg-amber-50 text-amber-700'}`}>
                    <Icon name={role.icon} />
                  </div>
                  <h3 className="mt-5 font-bold text-slate-950">{role.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{role.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-8 px-5 pb-20 sm:px-8 sm:pb-24 lg:px-10">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-[#101b36] px-6 py-10 text-white sm:px-10 sm:py-14 lg:px-14">
            <div className="grid gap-10 md:grid-cols-[0.9fr_1.1fr] md:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">From first step to next opportunity</p>
                <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">A better process starts with a connected campus.</h2>
                <p className="mt-4 max-w-lg leading-7 text-slate-300">Give your placement team a practical space to coordinate hiring, support students, connect alumni, and understand outcomes.</p>
                <Link to="/register" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-slate-950 transition hover:bg-blue-50">
                  Get started <Icon name="arrow" className="h-4 w-4" />
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['01', 'Create a profile', 'Bring academic and professional details together.'],
                  ['02', 'Discover opportunities', 'Find roles and mentors that match your goals.'],
                  ['03', 'Move through the process', 'Track applications, decisions, and interviews.'],
                  ['04', 'Understand outcomes', 'Use placement insights to guide the next step.']
                ].map(([number, title, detail]) => (
                  <div key={number} className="rounded-2xl border border-white/10 bg-white/[0.05] p-5">
                    <span className="text-xs font-bold tracking-widest text-cyan-300">{number}</span>
                    <h3 className="mt-3 font-semibold">{title}</h3>
                    <p className="mt-2 text-sm leading-5 text-slate-400">{detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <Brand />
          <p className="text-sm text-slate-500">Connecting campus talent to what comes next.</p>
          <div className="flex items-center gap-5 text-sm font-medium text-slate-600">
            <Link className="hover:text-blue-700" to="/jobs">Opportunities</Link>
            <Link className="hover:text-blue-700" to="/login">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
