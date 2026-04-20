import type { JobEnvelope, JobType } from '@viberun/shared';

export interface EnqueueArgs {
  userId: string;
  projectId: string | null;
  type: JobType;
  payload: unknown;
}

export interface JobQueue {
  enqueue(args: EnqueueArgs): Promise<JobEnvelope>;
  claimNext(deviceId: string): Promise<JobEnvelope | null>;
  heartbeat(jobId: string): Promise<void>;
  complete(jobId: string, result: unknown): Promise<void>;
  fail(jobId: string, error: string): Promise<void>;
  requeue(jobId: string, error: string): Promise<void>;
  get(jobId: string): Promise<JobEnvelope | null>;
}
