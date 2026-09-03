console.log('Scheduler service starting...');

setInterval(() => {
  console.log(`[${new Date().toISOString()}] Scheduler heartbeat — no jobs to schedule yet`);
}, 5000);