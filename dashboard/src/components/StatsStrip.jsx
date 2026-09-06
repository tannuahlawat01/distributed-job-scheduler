function StatCard({ label, value, accent }) {
  return (
    <div className="bg-panel border border-border rounded px-4 py-3 flex-1">
      <div className="text-muted text-xs uppercase tracking-wide mb-1">{label}</div>
      <div className={`font-mono text-2xl ${accent ?? 'text-text'}`}>{value}</div>
    </div>
  );
}

export default function StatsStrip({ stats }) {
  if (!stats) return null;

  return (
    <div className="flex gap-3 mb-6">
      <StatCard label="Total" value={stats.total} />
      <StatCard label="Running" value={stats.running} accent="text-accent" />
      <StatCard label="Queued" value={stats.queued} />
      <StatCard label="Success" value={stats.success} accent="text-accent" />
      <StatCard label="Failed" value={stats.failed} accent="text-warn" />
    </div>
  );
}