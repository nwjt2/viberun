import type { SupabaseClient } from '@supabase/supabase-js';
import { JobEnvelopeSchema, type JobEnvelope } from '@viberun/shared';
import type { EnqueueArgs, JobQueue } from './types.js';

// Supabase-backed queue. Uses RLS-scoped queries; caller must already be
// authenticated with the user's session (see ../auth/supabase.ts).
export class SupabaseJobQueue implements JobQueue {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly deviceId: string,
  ) {}

  async enqueue({ userId, projectId, type, payload }: EnqueueArgs): Promise<JobEnvelope> {
    const { data, error } = await this.supabase
      .from('jobs')
      .insert({ user_id: userId, project_id: projectId, type, payload })
      .select()
      .single();
    if (error || !data) throw new Error(`enqueue failed: ${error?.message ?? 'no row returned'}`);
    return this.fromRow(data);
  }

  async claimNext(): Promise<JobEnvelope | null> {
    // Supabase-js doesn't expose `FOR UPDATE SKIP LOCKED` directly, so we use
    // an RPC that wraps the statement. The migration creates `claim_next_job`.
    const { data, error } = await this.supabase.rpc('claim_next_job', {
      device_id: this.deviceId,
    });
    if (error) throw new Error(`claim_next_job failed: ${error.message}`);
    if (!data) return null;
    return this.fromRow(Array.isArray(data) ? data[0] : data);
  }

  async heartbeat(jobId: string): Promise<void> {
    const { error } = await this.supabase
      .from('jobs')
      .update({ heartbeat_at: new Date().toISOString() })
      .eq('id', jobId);
    if (error) throw new Error(`heartbeat failed: ${error.message}`);
  }

  async complete(jobId: string, result: unknown): Promise<void> {
    const { error } = await this.supabase
      .from('jobs')
      .update({ status: 'done', result })
      .eq('id', jobId);
    if (error) throw new Error(`complete failed: ${error.message}`);
  }

  async fail(jobId: string, errorMsg: string): Promise<void> {
    const { error } = await this.supabase
      .from('jobs')
      .update({ status: 'failed', error: errorMsg })
      .eq('id', jobId);
    if (error) throw new Error(`fail failed: ${error.message}`);
  }

  async requeue(jobId: string, errorMsg: string): Promise<void> {
    const { data: existing } = await this.supabase.from('jobs').select('retries').eq('id', jobId).single();
    const { error } = await this.supabase
      .from('jobs')
      .update({ status: 'queued', error: errorMsg, retries: ((existing as { retries?: number } | null)?.retries ?? 0) + 1 })
      .eq('id', jobId);
    if (error) throw new Error(`requeue failed: ${error.message}`);
  }

  async get(jobId: string): Promise<JobEnvelope | null> {
    const { data, error } = await this.supabase.from('jobs').select('*').eq('id', jobId).maybeSingle();
    if (error) throw new Error(`get failed: ${error.message}`);
    if (!data) return null;
    return this.fromRow(data);
  }

  private fromRow(row: Record<string, unknown>): JobEnvelope {
    const camel = {
      id: row.id as string,
      userId: row.user_id as string,
      projectId: (row.project_id as string | null) ?? null,
      type: row.type,
      payload: row.payload,
      status: row.status,
      result: row.result ?? undefined,
      error: (row.error as string | null) ?? null,
      retries: (row.retries as number) ?? 0,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
    return JobEnvelopeSchema.parse(camel);
  }
}
