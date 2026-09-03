import express from 'express';
import prisma from './db.js';
import { pushJob } from './queue.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'api', timestamp: new Date().toISOString() });
});

// Create a job
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

// List all jobs
app.get('/jobs', async (req, res) => {
  const jobs = await prisma.job.findMany({
    orderBy: { createdAt: 'desc' },
  });
  res.json(jobs);
});

// Get one job
app.get('/jobs/:id', async (req, res) => {
  const job = await prisma.job.findUnique({
    where: { id: req.params.id },
  });

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json(job);
});

app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
});