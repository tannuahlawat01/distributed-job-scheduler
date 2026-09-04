import redis from './redis.js';

const HEARTBEAT_TTL_SECONDS = 10;

export async function sendHeartbeat(workerId, currentJobId = null) {
  const key = `worker:heartbeat:${workerId}`;
  const value = JSON.stringify({
    workerId,
    currentJobId,
    timestamp: Date.now(),
  });
  await redis.set(key, value, 'EX', HEARTBEAT_TTL_SECONDS);
}