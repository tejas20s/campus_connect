export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-50">
      <div className="max-w-lg rounded-3xl border border-red-500/30 bg-slate-900 p-10 text-center shadow-soft">
        <p className="text-sm uppercase tracking-[0.15em] text-red-300">Access denied</p>
        <h1 className="mt-4 text-4xl font-bold">Unauthorized</h1>
        <p className="mt-3 text-slate-300">You do not have permissions to access this area.</p>
      </div>
    </div>
  );
}
