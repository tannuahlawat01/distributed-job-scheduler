import { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:4000';

function App() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/stats`)
      .then((res) => res.json())
      .then(setStats);
  }, []);

  return (
    <div className="min-h-screen bg-bg text-text p-6">
      <h1 className="text-xl font-semibold mb-4">Job Scheduler Dashboard</h1>
      {stats ? (
        <pre className="font-mono text-sm text-muted">{JSON.stringify(stats, null, 2)}</pre>
      ) : (
        <p className="text-muted">Loading...</p>
      )}
    </div>
  );
}

export default App;