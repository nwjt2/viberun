import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import {
  TokenBucket,
  UsageMeter,
  QuotaError,
  makeRateLimitedProvider,
  isRateLimitError,
  extractRetryAfterMs,
} from './rate-limit.js';
import { logger } from '../util/logger.js';
import type { ModelProvider } from './provider.js';

describe('TokenBucket', () => {
  it('starts full and drains one per acquire', async () => {
    const b = new TokenBucket(10);
    expect(b.peek()).toBe(10);
    await b.acquire();
    expect(b.peek()).toBe(9);
  });

  it('blocks when empty until a token refills', async () => {
    const b = new TokenBucket(120); // 1 token every 500ms
    for (let i = 0; i < 120; i++) await b.acquire();
    const start = Date.now();
    await b.acquire();
    expect(Date.now() - start).toBeGreaterThan(200);
  });
});

describe('error detection', () => {
  it('recognizes 429 / quota / rate-limit phrasings', () => {
    expect(isRateLimitError(new Error('HTTP 429 Too Many Requests'))).toBe(true);
    expect(isRateLimitError(new Error('Resource has been exhausted'))).toBe(true);
    expect(isRateLimitError(new Error('Quota exceeded for model'))).toBe(true);
    expect(isRateLimitError(new Error('random failure'))).toBe(false);
    expect(isRateLimitError('not an error')).toBe(false);
  });

  it('extracts retry-after hints', () => {
    expect(extractRetryAfterMs(new Error('retry-after: 30 seconds'))).toBe(30_000);
    expect(extractRetryAfterMs(new Error('retryDelay: "5s"'))).toBe(5_000);
    expect(extractRetryAfterMs(new Error('retry 2500 ms'))).toBe(2_500);
    expect(extractRetryAfterMs(new Error('no hint'))).toBeNull();
  });
});

describe('UsageMeter', () => {
  let dir: string;
  let path: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'viberun-usage-'));
    path = join(dir, 'usage.json');
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('records requests and persists to disk', async () => {
    const meter = new UsageMeter(path);
    await meter.recordOne();
    await meter.recordOne();
    const raw = JSON.parse(await readFile(path, 'utf8')) as { count: number; date: string };
    expect(raw.count).toBe(2);
    expect(raw.date).toBe(new Date().toISOString().slice(0, 10));
  });

  it('snapshot reflects rollover at UTC midnight', async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    await (async () => {
      const seed = new UsageMeter(path);
      // Forge yesterday's state by touching the internal cache path.
      await seed.recordOne();
    })();
    // Rewrite the file to yesterday.
    await (await import('node:fs/promises')).writeFile(
      path,
      JSON.stringify({ date: yesterday, count: 999, lastRequest: new Date(0).toISOString() }),
    );
    const fresh = new UsageMeter(path);
    const snap = await fresh.snapshot();
    expect(snap.date).toBe(new Date().toISOString().slice(0, 10));
    expect(snap.count).toBe(0);
  });
});

describe('makeRateLimitedProvider', () => {
  let dir: string;
  let path: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'viberun-rl-'));
    path = join(dir, 'usage.json');
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('throws QuotaError when daily cap hit', async () => {
    const inner: ModelProvider = {
      name: 'fake',
      supportsStreaming: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async plan(): Promise<any> {
        return { ok: true };
      },
    };
    const wrapped = makeRateLimitedProvider(inner, { rpm: 60, dailyLimit: 1, meterPath: path }, logger);
    await wrapped.plan({ jobType: 't', prompt: 'x', schema: z.object({ ok: z.boolean() }) });
    await expect(
      wrapped.plan({ jobType: 't', prompt: 'x', schema: z.object({ ok: z.boolean() }) }),
    ).rejects.toBeInstanceOf(QuotaError);
  });

  it('retries with backoff on rate-limit errors then succeeds', async () => {
    let calls = 0;
    const inner: ModelProvider = {
      name: 'flaky',
      supportsStreaming: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async plan(): Promise<any> {
        calls += 1;
        if (calls < 3) throw new Error('HTTP 429 Too Many Requests');
        return { ok: true };
      },
    };
    const wrapped = makeRateLimitedProvider(
      inner,
      { rpm: 60, dailyLimit: 100, meterPath: path, maxBackoffMs: 10, maxRetries: 4 },
      logger,
    );
    const result = await wrapped.plan({
      jobType: 't',
      prompt: 'x',
      schema: z.object({ ok: z.boolean() }),
    });
    expect(result).toEqual({ ok: true });
    expect(calls).toBe(3);
  });

  it('propagates non-rate-limit errors without retrying', async () => {
    let calls = 0;
    const inner: ModelProvider = {
      name: 'broken',
      supportsStreaming: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async plan(): Promise<any> {
        calls += 1;
        throw new Error('syntax error in prompt');
      },
    };
    const wrapped = makeRateLimitedProvider(
      inner,
      { rpm: 60, dailyLimit: 100, meterPath: path, maxBackoffMs: 5 },
      logger,
    );
    await expect(
      wrapped.plan({ jobType: 't', prompt: 'x', schema: z.object({ ok: z.boolean() }) }),
    ).rejects.toThrow('syntax error');
    expect(calls).toBe(1);
  });
});
