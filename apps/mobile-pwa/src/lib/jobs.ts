import type { JobEnvelope, JobType } from '@viberun/shared';
import { supabase, localMode } from './supabase';

// In local mode, talk to the companion's local HTTP server. Two ways the PWA
// reaches it:
//   1. Same-origin via /api/companion (dev: Vite proxy to :4000; or a reverse
//      proxy that serves both the PWA and the companion on one host).
//   2. Cross-origin via an explicit VITE_COMPANION_BASE_URL, typically a
//      tunnel (cloudflared / tailscale / ngrok) pointing at the companion's
//      local port. Set at build time or at runtime (see store below).
const DEFAULT_LOCAL_BASE = '/api/companion';

const RUNTIME_BASE_KEY = 'viberun.companionBaseUrl';

export function setCompanionBaseUrl(url: string | null): void {
  try {
    if (url) localStorage.setItem(RUNTIME_BASE_KEY, url);
    else localStorage.removeItem(RUNTIME_BASE_KEY);
  } catch {
    /* no-op */
  }
}

export function getCompanionBaseUrl(): string {
  try {
    const runtime = localStorage.getItem(RUNTIME_BASE_KEY);
    if (runtime) return runtime.replace(/\/$/, '');
  } catch {
    /* no-op */
  }
  const buildTime = import.meta.env.VITE_COMPANION_BASE_URL as string | undefined;
  if (buildTime) return buildTime.replace(/\/$/, '');
  return DEFAULT_LOCAL_BASE;
}

export async function enqueueJob<T extends JobType>(args: {
  type: T;
  payload: unknown;
  projectId?: string | null;
  userId?: string;
}): Promise<JobEnvelope> {
  if (localMode || !supabase) {
    const res = await fetch(`${getCompanionBaseUrl()}/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        userId: args.userId ?? 'local-user',
        projectId: args.projectId ?? null,
        type: args.type,
        payload: args.payload,
      }),
    });
    if (!res.ok) throw new Error(`enqueue failed: ${res.status}`);
    return res.json();
  }
  const { data, error } = await supabase
    .from('jobs')
    .insert({
      user_id: args.userId,
      project_id: args.projectId ?? null,
      type: args.type,
      payload: args.payload,
    })
    .select()
    .single();
  if (error || !data) throw new Error(`enqueue failed: ${error?.message ?? 'no row'}`);
  return data as JobEnvelope;
}

export async function getJob(jobId: string): Promise<JobEnvelope | null> {
  if (localMode || !supabase) {
    const res = await fetch(`${getCompanionBaseUrl()}/jobs/${jobId}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`get job failed: ${res.status}`);
    return res.json();
  }
  const { data, error } = await supabase.from('jobs').select('*').eq('id', jobId).maybeSingle();
  if (error) throw new Error(`get job failed: ${error.message}`);
  return (data as JobEnvelope | null) ?? null;
}

// Polls until the job is done or failed, with exponential-ish backoff.
export async function waitForJob(
  jobId: string,
  { timeoutMs = 120_000, signal }: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<JobEnvelope> {
  const start = Date.now();
  let delay = 250;
  while (true) {
    if (signal?.aborted) throw new Error('aborted');
    const job = await getJob(jobId);
    if (!job) throw new Error(`job ${jobId} not found`);
    if (job.status === 'done' || job.status === 'failed') return job;
    if (Date.now() - start > timeoutMs) throw new Error(`job ${jobId} timed out`);
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.4, 1500);
  }
}

export async function companionAlive(): Promise<boolean> {
  try {
    const res = await fetch(`${getCompanionBaseUrl()}/healthz`);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Preview URLs come back from the companion as either an absolute URL (when
 * it's configured with VIBERUN_PUBLIC_BASE_URL or has a real deploy provider
 * like Firebase) or a `/api/companion/preview/...` relative URL. When the
 * PWA is on a different origin from the companion — the normal phone case —
 * we need to rewrite the relative form to the configured base URL.
 */
export function resolvePreviewUrl(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  const base = getCompanionBaseUrl();
  if (url.startsWith('/api/companion/')) {
    return base + url.slice('/api/companion'.length);
  }
  if (url.startsWith('/')) return base + url;
  return url;
}

export interface UsageStatus {
  provider: string;
  rpm: number | null;
  dailyLimit: number | null;
  today: { date: string; count: number };
}

/** Fetch the companion's current request-quota snapshot. */
export async function getUsage(): Promise<UsageStatus | null> {
  try {
    const res = await fetch(`${getCompanionBaseUrl()}/usage`);
    if (!res.ok) return null;
    return (await res.json()) as UsageStatus;
  } catch {
    return null;
  }
}

export interface ProjectStatus {
  exists: boolean;
  hasDist: boolean;
}

/**
 * Check whether the companion still has a workspace for this project id. The
 * Resume screen uses this to detect workspaces that were deleted off-laptop
 * (e.g. user cleared /tmp) so it can offer a clean reset instead of failing
 * mid-build.
 */
export async function getProjectStatus(projectId: string): Promise<ProjectStatus | null> {
  if (!localMode) return null; // supabase-mode lookup is different; N/A for iter 3
  try {
    const res = await fetch(`${getCompanionBaseUrl()}/projects/${encodeURIComponent(projectId)}`);
    if (res.status === 404) return { exists: false, hasDist: false };
    if (!res.ok) return null;
    return (await res.json()) as ProjectStatus;
  } catch {
    return null;
  }
}
