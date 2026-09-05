import redis from './redis.js';
import prisma from './db.js';
import { sendHeartbeat } from './heartbeat.js';

const workerId = process.env.HOSTNAME || 'worker-unknown';
const QUEUE_KEY = 'jobs:queue';
const POLL_INTERVAL_MS = 2000;
const HEARTBEAT_INTERVAL_MS = 3000;

let currentJobId = null;

console.log(`Worker ${workerId} starting...`);

function computeScore(priority) {
  const invertedPriority = 10 - priority;
  const timestamp = Date.now();
  return invertedPriority * 1e13 + timestamp;
}
async function claimJob() {
  // ZPOPMIN is atomic — only one worker can ever pop a given job
  const result = await redis.zpopmin(QUEUE_KEY, 1);
  if (result.length === 0) return null;
  const [jobId] = result;
  return jobId;
}

async function executeJob(jobId, retryCount, maxRetries, timeoutSeconds) {
  currentJobId = jobId;
  console.log(`Worker ${workerId} claimed job ${jobId} (attempt ${retryCount + 1})`);

  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: 'RUNNING',
      startedAt: new Date(),
      workerId,
    },
  });

  const actualWork = (async () => {
    const duration = 2000 + Math.random() * 2000;
    await new Promise((resolve) => setTimeout(resolve, duration));

    const shouldFail = Math.random() < 0.4;
    if (shouldFail) {
      throw new Error('Simulated job failure');
    }
  })();

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('TIMEOUT')), timeoutSeconds * 1000);
  });

  await Promise.race([actualWork, timeoutPromise]);

  // Only reached if actualWork won the race without throwing
  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: 'SUCCESS',
      completedAt: new Date(),
      result: `Executed successfully by ${workerId}`,
    },
  });

  console.log(`Worker ${workerId} completed job ${jobId}`);
  currentJobId = null;
}

async function pollLoop() {
  const jobId = await claimJob();

  if (jobId) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });

    try {
      await executeJob(jobId, job.retryCount, job.maxRetries, job.timeout);
    } catch (err) {
      console.error(`Worker ${workerId} failed job ${jobId}:`, err.message);
      currentJobId = null;

      const isTimeout = err.message === 'TIMEOUT';
      await handleJobFailure(job, err.message, isTimeout);
    }
  } else {
    console.log(`[${new Date().toISOString()}] Worker ${workerId} — queue empty, idle`);
  }

  setTimeout(pollLoop, POLL_INTERVAL_MS);
}

async function handleJobFailure(job, errorMessage, isTimeout = false) {
  const newRetryCount = job.retryCount + 1;

  await prisma.jobAttempt.create({
    data: {
      jobId: job.id,
      workerId,
      attemptNum: newRetryCount,
      status: isTimeout ? 'TIMEOUT' : 'FAILED',
      error: errorMessage,
      completedAt: new Date(),
    },
  });

  if (newRetryCount >= job.maxRetries) {
    console.log(`Job ${job.id} exhausted retries (${newRetryCount}/${job.maxRetries}) — moving to DLQ`);

    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: isTimeout ? 'TIMEOUT' : 'FAILED',
        retryCount: newRetryCount,
        error: errorMessage,
        completedAt: new Date(),
      },
    });

    await redis.zadd('jobs:dlq', Date.now(), job.id);
  } else {
    const backoffSeconds = Math.pow(2, newRetryCount);
    console.log(`Job ${job.id} will retry in ${backoffSeconds}s (attempt ${newRetryCount + 1}/${job.maxRetries})`);

    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'RETRYING',
        retryCount: newRetryCount,
        error: errorMessage,
      },
    });

    setTimeout(async () => {
      const score = computeScore(job.priority);
      await redis.zadd(QUEUE_KEY, score, job.id);

      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'QUEUED' },
      });
    }, backoffSeconds * 1000);
  }
}

async function heartbeatLoop() {
  await sendHeartbeat(workerId, currentJobId);
  setTimeout(heartbeatLoop, HEARTBEAT_INTERVAL_MS);
}

// Both loops start independently — heartbeat keeps beating even during a long-running job
pollLoop();
heartbeatLoop();