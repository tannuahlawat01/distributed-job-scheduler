const workerId = process.env.HOSTNAME || 'worker-unknown';

console.log(`Worker ${workerId} starting...`);

setInterval(() => {
  console.log(`[${new Date().toISOString()}] Worker ${workerId} heartbeat — idle, no jobs yet`);
}, 5000);