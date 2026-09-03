import redis from './redis.js';
import prisma from './db.js';

const workerId = process.env.HOSTNAME || 'worker-unknown';
const QUEUE_KEY = 'jobs:queue';
const POLL_INTERVAL_MS = 2000;

console.log(`Worker ${workerId} starting...`);

async function claimJob() {
  // ZPOPMIN is atomic — only one worker can ever pop a given job
  const result = await redis.zpopmin(QUEUE_KEY, 1);
  if (result.length === 0) return null;
  const [jobId] = result;
  return jobId;
}

async function executeJob(jobId) {
  console.log(`Worker ${workerId} claimed job ${jobId}`);

  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: 'RUNNING',
      startedAt: new Date(),
      workerId,
    },
  });

  // Fake execution — simulate work taking 2-4 seconds
  const duration = 2000 + Math.random() * 2000;
  await new Promise((resolve) => setTimeout(resolve, duration));

  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: 'SUCCESS',
      completedAt: new Date(),
      result: `Executed successfully by ${workerId}`,
    },
  });

  console.log(`Worker ${workerId} completed job ${jobId}`);
}

async function pollLoop() {
  const jobId = await claimJob();

  if (jobId) {
    try {
      await executeJob(jobId);
    } catch (err) {
      console.error(`Worker ${workerId} failed job ${jobId}:`, err.message);
    }
  } else {
    console.log(`[${new Date().toISOString()}] Worker ${workerId} — queue empty, idle`);
  }

  setTimeout(pollLoop, POLL_INTERVAL_MS);
}

pollLoop();