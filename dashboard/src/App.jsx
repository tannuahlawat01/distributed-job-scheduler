import { useState, useEffect, useCallback } from 'react';
import StatsStrip from './components/StatsStrip';
import JobTable from './components/JobTable';
import WorkerPanel from './components/WorkerPanel';
import { useJobSocket } from './hooks/useJobSocket';

const API_BASE = 'http://localhost:4000';

function App() {
  const [stats, setStats] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [workers, setWorkers] = useState([]);

  const fetchAll = useCallback(() => {
    fetch(`${API_BASE}/stats`).then((r) => r.json()).then(setStats);
    fetch(`${API_BASE}/jobs`).then((r) => r.json()).then((data) => setJobs(data.slice(0, 20)));
    fetch(`${API_BASE}/workers`).then((r) => r.json()).then(setWorkers);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useJobSocket(fetchAll);

  return (
    <div className="min-h-screen bg-bg text-text p-6">
      <h1 className="text-xl font-semibold mb-6">Job Scheduler Dashboard</h1>

      <StatsStrip stats={stats} />

      <div className="grid grid-cols-[1fr_280px] gap-4">
        <div>
          <h2 className="text-xs uppercase tracking-wide text-muted mb-2">Recent Jobs</h2>
          <JobTable jobs={jobs} />
        </div>
        <WorkerPanel workers={workers} />
      </div>
    </div>
  );
}

export default App;