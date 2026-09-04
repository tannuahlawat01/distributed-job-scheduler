import redis from './redis.js';
import prisma from './db.js';

const CHECK_INTERVAL_MS = 5000;
const QUEUE_KEY = 'jobs:queue';

console.log('Scheduler service starting...');

function computeScore(priority) {
  const invertedPriority = 10 - priority;
  const timestamp = Date.now();
  return invertedPriority * 1e13 + timestamp;
}

async function getAliveWorkerIds() {
  const keys = await redis.keys('worker:heartbeat:*');
  return keys.map((key) => key.replace('worker:heartbeat:', ''));
}

async function syncWorkerRegistry(aliveWorkerIds) {
  // Ensure every alive worker has a row in Postgres, marked ONLINE
  for (const workerId of aliveWorkerIds) {
    await prisma.worker.upsert({
      where: { id: workerId },
      update: { status: 'ONLINE', lastHeartbeat: new Date() },
      create: { id: workerId, status: 'ONLINE', lastHeartbeat: new Date() },
    });
  }
}

async function detectDeadWorkers(aliveWorkerIds) {
  // Find workers Postgres thinks are ONLINE but have no current heartbeat
  const onlineWorkersInDb = await prisma.worker.findMany({
    where: { status: 'ONLINE' },
  });

  for (const worker of onlineWorkersInDb) {
    if (!aliveWorkerIds.includes(worker.id)) {
      console.log(`Worker ${worker.id} appears dead (no heartbeat) — marking OFFLINE`);

      await prisma.worker.update({
        where: { id: worker.id },
        data: { status: 'OFFLINE' },
      });

      // If this worker was mid-job, requeue that job
      const abandonedJob = await prisma.job.findFirst({
        where: { workerId: worker.id, status: 'RUNNING' },
      });

      if (abandonedJob) {
        console.log(`Requeuing abandoned job ${abandonedJob.id} from dead worker ${worker.id}`);

        await prisma.job.update({
          where: { id: abandonedJob.id },
          data: { status: 'QUEUED', workerId: null },
        });

        const score = computeScore(abandonedJob.priority);
        await redis.zadd(QUEUE_KEY, score, abandonedJob.id);
      }
    }
  }
}

async function checkLoop() {
  try {
    const aliveWorkerIds = await getAliveWorkerIds();
    await syncWorkerRegistry(aliveWorkerIds);
    await detectDeadWorkers(aliveWorkerIds);
    console.log(`[${new Date().toISOString()}] Scheduler check — ${aliveWorkerIds.length} worker(s) alive`);
  } catch (err) {
    console.error('Scheduler check failed:', err.message);
  }

  setTimeout(checkLoop, CHECK_INTERVAL_MS);
}

checkLoop();