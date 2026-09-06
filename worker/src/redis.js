import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

redis.on('connect', () => console.log('Connected to Redis'));
redis.on('error', (err) => console.error('Redis error:', err));

export async function publishJobUpdate(jobId, status) {
  await redis.publish('job-updates', JSON.stringify({ type: 'job-update', jobId, status }));
}

export default redis;