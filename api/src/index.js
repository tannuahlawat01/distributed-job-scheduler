import express from 'express';
import http from 'http';
import cors from 'cors';
import prisma from './db.js';
import { pushJob } from './queue.js';
import { initWebSocketServer } from './ws.js';
import { startSubscriber } from './pubsub.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'api', timestamp: new Date().toISOString() });
});

app.post('/jobs', async (req, res) => {
  const { name, command, priority, maxRetries, timeout, scheduledAt } = req.body;

  if (!name || !command) {
    return res.status(400).json({ error: 'name and command are required' });
  }

  let job = await prisma.job.create({
    data: {
      name,
      command,
      priority: priority ?? 5,
      maxRetries: maxRetries ?? 3,
      timeout: timeout ?? 30,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    },
  });

  if (!job.scheduledAt) {
    await pushJob(job.id, job.priority);
    job = await prisma.job.update({
      where: { id: job.id },
      data: { status: 'QUEUED' },
    });
  }

  res.status(201).json(job);
});

app.get('/jobs', async (req, res) => {
  const jobs = await prisma.job.findMany({
    orderBy: { createdAt: 'desc' },
  });
  res.json(jobs);
});

app.get('/jobs/:id', async (req, res) => {
  const job = await prisma.job.findUnique({
    where: { id: req.params.id },
  });

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json(job);
});

app.get('/workers', async (req, res) => {
  const workers = await prisma.worker.findMany({
    orderBy: { lastHeartbeat: 'desc' },
  });
  res.json(workers);
});

app.get('/stats', async (req, res) => {
  const [total, running, queued, success, failed] = await Promise.all([
    prisma.job.count(),
    prisma.job.count({ where: { status: 'RUNNING' } }),
    prisma.job.count({ where: { status: 'QUEUED' } }),
    prisma.job.count({ where: { status: 'SUCCESS' } }),
    prisma.job.count({ where: { status: { in: ['FAILED', 'TIMEOUT'] } } }),
  ]);

  res.json({ total, running, queued, success, failed });
});

const server = http.createServer(app);
initWebSocketServer(server);
startSubscriber();

server.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
});