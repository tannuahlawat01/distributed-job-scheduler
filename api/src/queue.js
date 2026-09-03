import redis from './redis.js';

const QUEUE_KEY = 'jobs:queue';

export function computeScore(priority) {
  const invertedPriority = 10 - priority;
  const timestamp = Date.now();
  return invertedPriority * 1e13 + timestamp;
}

export async function pushJob(jobId, priority) {
  const score = computeScore(priority);
  await redis.zadd(QUEUE_KEY, score, jobId);
}

export async function queueLength() {
  return redis.zcard(QUEUE_KEY);
}