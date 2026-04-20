import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { z } from 'zod';
import type { ModelProvider } from './provider.js';
import { ProviderError } from './provider.js';
import type { Logger } from '../util/logger.js';

// Stay-in-the-free-tier guardrails for model providers. Wraps any
// ModelProvider with:
//   - Per-minute token bucket (requests per minute ceiling)
//   - Daily request counter persisted to disk
//   - Exponential backoff when the underlying provider returns a rate-limit
//     error (HTTP 429, "quota exceeded", "Resource has been exhausted").
// The Gemini free tier is the primary target — quick to hit mid-run if we
// don't cap ourselves. Other providers with real quotas (Claude, OpenAI)
// plug in the same way with different defaults.

export interface RateLimitConfig {
  rpm: number;           // requests per minute (token bucket size = rpm)
  dailyLimit?: number;   // requests per day before we refuse
  meterPath: string;     // persisted usage path
  maxBackoffMs?: number; // cap on exponential backoff per attempt
  maxRetries?: number;   // how many times to retry on rate-limit errors
}

export class QuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaError';
  }
}

// Recommended conservative defaults per provider. Google publishes larger
// numbers for the current Gemini free tier, but we want headroom.
export const DEFAULT_RATE_LIMITS: Record<string, { rpm: number; dailyLimit: number }> = {
  'gemini-cli': { rpm: 10, dailyLimit: 200 },
  // Paid upgrades can raise these via config; see docs/dev/paid-upgrade-surface.md.
  claude: { rpm: 30, dailyLimit: 2000 },
  openai: { rpm: 60, dailyLimit: 2000 },
};

interface UsageState {
  date: string; // YYYY-MM-DD, UTC
  count: number;
  lastRequest: string;
}

export class UsageMeter {
  private cache: UsageState | null = null;

  constructor(private readonly path: string) {}

  async load(): Promise<UsageState> {
    if (this.cache) return this.cache;
    try {
      const raw = await readFile(this.path, 'utf8');
      this.cache = JSON.parse(raw) as UsageState;
    } catch {
      this.cache = { date: todayUtc(), count: 0, lastRequest: new Date(0).toISOString() };
    }
    return this.cache;
  }

  async snapshot(): Promise<UsageState> {
    const state = await this.load();
    const today = todayUtc();
    if (state.date !== today) return { date: today, count: 0, lastRequest: state.lastRequest };
    return { ...state };
  }

  async recordOne(): Promise<UsageState> {
    const today = todayUtc();
    const prev = await this.load();
    const next: UsageState =
      prev.date === today
        ? { date: today, count: prev.count + 1, lastRequest: new Date().toISOString() }
        : { date: today, count: 1, lastRequest: new Date().toISOString() };
    this.cache = next;
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, JSON.stringify(next, null, 2) + '\n', 'utf8');
    return next;
  }
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

// Token-bucket that refills one token every (60_000 / rpm) ms, capped at rpm
// tokens. Callers await `acquire()` which resolves when a token is available.
export class TokenBucket {
  private tokens: number;
  private readonly capacity: number;
  private readonly refillMs: number;
  private lastRefill: number;

  constructor(rpm: number) {
    this.capacity = Math.max(1, Math.floor(rpm));
    this.refillMs = 60_000 / this.capacity;
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const earned = Math.floor(elapsed / this.refillMs);
    if (earned > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + earned);
      this.lastRefill += earned * this.refillMs;
    }
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens > 0) {
      this.tokens -= 1;
      return;
    }
    // Wait until the next token mints. Slight jitter so multi-call callers
    // don't thundering-herd.
    const wait = this.refillMs - (Date.now() - this.lastRefill) + Math.random() * 50;
    await sleep(Math.max(10, wait));
    return this.acquire();
  }

  peek(): number {
    this.refill();
    return this.tokens;
  }
}

export function isRateLimitError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('rate_limit') ||
    msg.includes('resource has been exhausted') ||
    msg.includes('resource exhausted') ||
    msg.includes('too many requests')
  );
}

export function extractRetryAfterMs(err: unknown): number | null {
  if (!(err instanceof Error)) return null;
  // Google's error surface sometimes includes `retry-after: N seconds` or
  // `retryDelay: "30s"`. Scan the message.
  const m = /retry(?:-after|[-_ ]?delay|\s+)[^\d]*(\d+)\s*(ms|s|sec)?/i.exec(err.message);
  if (!m) return null;
  const value = Number(m[1]);
  const unit = (m[2] ?? 's').toLowerCase();
  if (unit === 'ms') return value;
  return value * 1000;
}

export function makeRateLimitedProvider(
  inner: ModelProvider,
  config: RateLimitConfig,
  logger: Logger,
): ModelProvider {
  const bucket = new TokenBucket(config.rpm);
  const meter = new UsageMeter(config.meterPath);
  const maxBackoff = config.maxBackoffMs ?? 60_000;
  const maxRetries = config.maxRetries ?? 3;

  return {
    name: `rate-limited(${inner.name})`,
    supportsStreaming: inner.supportsStreaming,
    async plan<T>(args: { jobType: string; prompt: string; schema: z.ZodType<T> }): Promise<T> {
      if (config.dailyLimit != null) {
        const state = await meter.snapshot();
        if (state.count >= config.dailyLimit) {
          throw new QuotaError(
            `Daily request cap hit (${state.count}/${config.dailyLimit}). Resets at UTC midnight. Configure VIBERUN_RATE_DAILY=... to raise it, or switch providers.`,
          );
        }
      }
      await bucket.acquire();

      let attempt = 0;
      let lastErr: unknown;
      while (attempt <= maxRetries) {
        try {
          const result = await inner.plan(args);
          await meter.recordOne();
          return result;
        } catch (err) {
          lastErr = err;
          if (!isRateLimitError(err) || attempt === maxRetries) throw err;
          const hint = extractRetryAfterMs(err);
          const backoff = Math.min(
            maxBackoff,
            hint ?? 1000 * 2 ** attempt + Math.floor(Math.random() * 500),
          );
          logger.warn(
            { attempt, backoff, error: (err as Error).message.slice(0, 200) },
            'rate-limit — backing off',
          );
          await sleep(backoff);
          attempt += 1;
        }
      }
      throw lastErr ?? new ProviderError('retries exhausted');
    },
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
