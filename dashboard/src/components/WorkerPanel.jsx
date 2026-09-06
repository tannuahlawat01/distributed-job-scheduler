export default function WorkerPanel({ workers }) {
  return (
    <div className="bg-panel border border-border rounded p-4">
      <h2 className="text-xs uppercase tracking-wide text-muted mb-3">Workers</h2>
      <div className="space-y-2">
        {workers.map((worker) => (
          <div key={worker.id} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  worker.status === 'ONLINE' ? 'bg-accent animate-pulse' : 'bg-warn'
                }`}
              />
              <span className="font-mono text-xs">{worker.id}</span>
            </div>
            <span className={`text-xs ${worker.status === 'ONLINE' ? 'text-accent' : 'text-warn'}`}>
              {worker.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}