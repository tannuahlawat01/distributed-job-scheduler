# Distributed Job Scheduler

A production-style distributed background job processing system — think a simplified Celery/BullMQ — built to demonstrate distributed systems concepts: fault tolerance, concurrency, priority queuing, and automatic failure recovery.

Multiple independent worker processes pull jobs from a shared queue, execute them concurrently, and recover automatically if a worker crashes mid-job — with zero jobs lost.

## Architecture

```
                    ┌──────────────────┐
                    │  React Dashboard │  (live via WebSocket)
                    └────────┬─────────┘
                             │ HTTP + WS
                             ▼
                    ┌──────────────────┐
                    │   API Server     │  Express
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
          PostgreSQL       Redis        Scheduler
          (job data)    (priority      (heartbeat
                          queue,        monitoring,
                          pub/sub)      requeue logic)
                                              │
                              ┌───────────────┼───────────────┐
                              ▼               ▼               ▼
                          Worker 1        Worker 2        Worker N
                          (Docker)        (Docker)        (Docker)
```

Each component runs as an independent Docker container, communicating only through Redis and PostgreSQL — never via direct function calls. Workers can be scaled dynamically:

```bash
docker compose up -d --scale worker=5
```

## Features

- **Priority queue** — jobs are processed by priority, then FIFO within the same priority, using a Redis sorted set
- **Atomic job claiming** — multiple workers compete for jobs with zero risk of double-processing, using Redis's atomic `ZPOPMIN`
- **Fault-tolerant worker failure detection** — workers send heartbeats via Redis keys with TTL; if a worker dies, the scheduler detects the missing heartbeat within seconds and automatically requeues its abandoned job to another worker
- **Retry with exponential backoff** — failed jobs retry with increasing delay (2s, 4s, 8s...) instead of hammering the system immediately
- **Dead-letter queue** — jobs that exhaust all retries are moved to a DLQ instead of being silently lost
- **Job timeouts** — jobs exceeding their configured timeout are treated as failures and follow the same retry/DLQ path
- **Real-time dashboard** — live job status, worker health, and system stats, updated via WebSocket + Redis pub/sub with zero polling

## Tech Stack

- **Backend:** Node.js, Express, Prisma ORM
- **Database:** PostgreSQL
- **Queue / Coordination:** Redis (sorted sets for priority queue and DLQ, key-TTL for heartbeats, pub/sub for real-time events)
- **Frontend:** React, Vite, Tailwind CSS
- **Real-time:** WebSocket (`ws`) + Redis pub/sub
- **Containerization:** Docker, Docker Compose

## How Job Scheduling Works

1. A job is submitted via `POST /jobs` and stored in PostgreSQL.
2. Its ID is pushed into a Redis sorted set, scored by `(10 - priority) × 10¹³ + timestamp` — this ensures higher-priority jobs are always popped first, with ties broken by submission order (FIFO).
3. Idle workers continuously poll the queue using `ZPOPMIN`, an atomic Redis command — this guarantees exactly one worker ever claims a given job, even with many workers polling simultaneously.
4. The claiming worker updates the job to `RUNNING` and executes it, racing the work against a timeout timer via `Promise.race`.

## How Failure Recovery Works

1. Every worker writes a heartbeat key to Redis every 3 seconds with a 10-second TTL.
2. If a worker crashes, it stops refreshing its key — Redis automatically expires it with no extra logic required. This is the failure detector: Redis's own key expiry *is* the "is this worker alive?" check.
3. A separate scheduler service polls Redis every 5 seconds for currently-alive heartbeat keys, and compares that against the workers PostgreSQL believes are `ONLINE`.
4. Any worker that's `ONLINE` in the database but has no live heartbeat key is marked `OFFLINE`.
5. If that worker was mid-job (a job still `RUNNING` under its ID), the scheduler requeues that job back into the Redis priority queue — a healthy worker picks it up and completes it, with no data or work lost.

This was tested live by killing a worker container (`docker kill`) while it held a job, and confirming a different worker automatically picked up and completed that exact job.

## How Retry, Backoff, and the Dead-Letter Queue Work

- On failure (a thrown error or a timeout), the worker logs the attempt and increments `retryCount`.
- If `retryCount < maxRetries`, the job is marked `RETRYING` and re-queued after an exponential backoff delay: `2^retryCount` seconds (2s, 4s, 8s, 16s...).
- Once `retryCount >= maxRetries`, the job is marked `FAILED` (or `TIMEOUT`) and pushed into a separate Redis sorted set (`jobs:dlq`), scored by failure timestamp — preserved for inspection rather than lost.

## Running Locally

Requires Docker Desktop.

```bash
git clone https://github.com/tannuahlawat01/distributed-job-scheduler.git
cd distributed-job-scheduler
docker compose up -d
```

This starts PostgreSQL, Redis, the API server, the scheduler, and 2 worker replicas. Run database migrations once, from inside `api/`:

```bash
cd api
npx prisma migrate dev
```

Start the dashboard separately:

```bash
cd dashboard
npm install
npm run dev
```

Open `http://localhost:5173` for the dashboard, or hit the API directly at `http://localhost:4000`.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/jobs` | Submit a new job |
| `GET` | `/jobs` | List all jobs |
| `GET` | `/jobs/:id` | Get a single job's details |
| `GET` | `/workers` | List all known workers and their status |
| `GET` | `/stats` | Aggregate counts (total/running/queued/success/failed) |

Example job submission:

```bash
curl -X POST http://localhost:4000/jobs \
  -H "Content-Type: application/json" \
  -d '{"name": "process data", "command": "echo hello", "priority": 8, "maxRetries": 3, "timeout": 30}'
```

## Database Schema

- **Job** — core job record: name, command, priority, status, retry/timeout config, timestamps, result/error
- **JobAttempt** — one row per execution attempt, preserving full retry history per job
- **Worker** — registry of every worker that has connected, its current status and heartbeat
- **JobLog** — structured execution logs per job (planned)

Indexes on `status`, `priority`, `createdAt`, and `scheduledAt` support the scheduler's constant "give me pending jobs by priority" queries.

## Scaling Workers

```bash
docker compose up -d --scale worker=5
```

The scheduler and API require no changes to support additional workers — this is the core proof that the system is genuinely distributed rather than simulated: workers communicate only through Redis and PostgreSQL, never through direct in-process calls.

## Future Improvements

- Authentication (JWT) so jobs are scoped per user
- Recurring/cron-style job scheduling
- Full execution log viewer in the dashboard
- Automated test suite (unit + integration across API → Redis → Scheduler → Worker → PostgreSQL)
- Worker CPU/memory metrics in the dashboard

## What This Project Demonstrates

- Distributed coordination without shared memory — every process talks only through Redis/PostgreSQL
- Atomic operations to prevent race conditions under real concurrent load
- A heartbeat-based failure detector — a genuine distributed systems pattern (the same idea behind how Kubernetes detects dead pods or Kafka detects dead consumers)
- Graceful degradation: a crashed worker never loses work, a failing job doesn't get abandoned, and retries don't overwhelm the system