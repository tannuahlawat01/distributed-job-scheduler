const STATUS_COLORS = {
  PENDING: 'text-muted',
  QUEUED: 'text-muted',
  RUNNING: 'text-accent',
  RETRYING: 'text-warn',
  SUCCESS: 'text-accent',
  FAILED: 'text-warn',
  TIMEOUT: 'text-warn',
  CANCELLED: 'text-muted',
};

function StatusBadge({ status }) {
  const isLive = status === 'RUNNING';
  return (
    <span className={`font-mono text-xs flex items-center gap-1.5 ${STATUS_COLORS[status] ?? 'text-text'}`}>
      {isLive && <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />}
      {status}
    </span>
  );
}

export default function JobTable({ jobs }) {
  return (
    <div className="bg-panel border border-border rounded overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted text-xs uppercase tracking-wide">
            <th className="text-left px-4 py-2 font-normal">Name</th>
            <th className="text-left px-4 py-2 font-normal">Status</th>
            <th className="text-left px-4 py-2 font-normal">Priority</th>
            <th className="text-left px-4 py-2 font-normal">Retries</th>
            <th className="text-left px-4 py-2 font-normal">Worker</th>
            <th className="text-left px-4 py-2 font-normal">Created</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} className="border-b border-border last:border-0 hover:bg-white/[0.02]">
              <td className="px-4 py-2">{job.name}</td>
              <td className="px-4 py-2"><StatusBadge status={job.status} /></td>
              <td className="px-4 py-2 font-mono text-muted">{job.priority}</td>
              <td className="px-4 py-2 font-mono text-muted">{job.retryCount}/{job.maxRetries}</td>
              <td className="px-4 py-2 font-mono text-muted text-xs">{job.workerId ?? '—'}</td>
              <td className="px-4 py-2 font-mono text-muted text-xs">
                {new Date(job.createdAt).toLocaleTimeString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}