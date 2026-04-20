import { randomUUID } from 'node:crypto';
import type { JobEnvelope } from '@viberun/shared';
import type { EnqueueArgs, JobQueue } from './types.js';

// In-memory queue used by the local dev HTTP server. No persistence: restart
// the companion and the queue is empty. That's fine for in-container smoke
// testing since the mobile PWA keeps its own progress in IndexedDB.
export class LocalJobQueue implements JobQueue {
  private readonly jobs = new Map<string, JobEnvelope>();

  async enqueue({ userId, projectId, type, payload }: EnqueueArgs): Promise<JobEnvelope> {
    const now = new Date().toISOString();
    const envelope: JobEnvelope = {
      id: randomUUID(),
      userId,
      projectId,
      type,
      payload,
      status: 'queued',
      retries: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(envelope.id, envelope);
    return envelope;
  }

  async claimNext(_deviceId: string): Promise<JobEnvelope | null> {
    const queued = [...this.jobs.values()]
      .filter((j) => j.status === 'queued')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    if (!queued) return null;
    queued.status = 'claimed';
    queued.updatedAt = new Date().toISOString();
    this.jobs.set(queued.id, queued);
    return queued;
  }

  async heartbeat(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.updatedAt = new Date().toISOString();
  }

  async complete(jobId: string, result: unknown): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = 'done';
    job.result = result;
    job.updatedAt = new Date().toISOString();
  }

  async fail(jobId: string, error: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = 'failed';
    job.error = error;
    job.updatedAt = new Date().toISOString();
  }

  async requeue(jobId: string, error: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = 'queued';
    job.error = error;
    job.retries += 1;
    job.updatedAt = new Date().toISOString();
  }

  async get(jobId: string): Promise<JobEnvelope | null> {
    return this.jobs.get(jobId) ?? null;
  }

  // Exposed for the HTTP layer — not part of the JobQueue interface.
  list(): JobEnvelope[] {
    return [...this.jobs.values()];
  }
}
