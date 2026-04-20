import { describe, it, expect } from 'vitest';
import { LocalJobQueue } from './queue/local.js';
import { Runner } from './jobs/runner.js';
import { buildRegistry } from './jobs/handlers/index.js';
import { mockProvider } from './model/providers/mock.js';
import { makeDeployProvider } from './deploy/index.js';
import { logger } from './util/logger.js';
import type { CompanionConfig } from './config.js';

const cfg: CompanionConfig = {
  mode: 'local',
  provider: { kind: 'mock' },
  workspacesDir: '/tmp/viberun-test',
  deviceLabel: 'test',
  localPort: 4001,
  deploy: { kind: 'local' },
};

const deploy = makeDeployProvider(cfg.deploy);
// mockProvider is used directly in the tests below — no rate limiting on mock.

async function runOnce<T>(fn: (queue: LocalJobQueue) => Promise<T>): Promise<{ queue: LocalJobQueue; result: T }> {
  const queue = new LocalJobQueue();
  const registry = buildRegistry();
  const runner = new Runner({ queue, registry, provider: mockProvider, deploy, logger, config: cfg, deviceId: 'test', pollIntervalMs: 10 });
  const done = runner.start();
  const result = await fn(queue);
  runner.stop();
  await done;
  return { queue, result };
}

describe('runner + mock provider', () => {
  it('processes generate_idea_options end-to-end', async () => {
    const { queue, result } = await runOnce(async (q) => {
      const job = await q.enqueue({
        userId: 'u',
        projectId: null,
        type: 'generate_idea_options',
        payload: { onboarding: { background: '', appInterests: [] }, excludeIds: [], count: 2 },
      });
      // Poll until done.
      for (let i = 0; i < 100; i++) {
        const current = await q.get(job.id);
        if (current?.status === 'done' || current?.status === 'failed') return current;
        await new Promise((r) => setTimeout(r, 20));
      }
      return q.get(job.id);
    });
    expect(result?.status).toBe('done');
    const output = result?.result as { options: Array<{ title: string }> };
    expect(output.options.length).toBeGreaterThan(0);
    expect(output.options[0]!.title).toBeTruthy();
    queue.list(); // keep tsc happy
  });

  it('derives a slice plan deterministically from a spec', async () => {
    const { result } = await runOnce(async (q) => {
      const job = await q.enqueue({
        userId: 'u',
        projectId: 'p',
        type: 'draft_slice_plan',
        payload: {
          spec: {
            name: 'Reads',
            slug: 'reads',
            pitch: 'A reading tracker.',
            shape: 'record_tracker',
            capabilities: ['landing', 'nav_shell', 'records', 'list', 'detail', 'create_edit', 'states'],
            entities: [
              {
                name: 'Entry',
                fields: [
                  { name: 'title', type: 'text', required: true, label: 'Title' },
                  { name: 'loggedAt', type: 'date', required: true, label: 'Logged at' },
                ],
              },
            ],
            userRoles: ['owner'],
            constraints: [],
          },
        },
      });
      for (let i = 0; i < 100; i++) {
        const current = await q.get(job.id);
        if (current?.status === 'done' || current?.status === 'failed') return current;
        await new Promise((r) => setTimeout(r, 20));
      }
      return q.get(job.id);
    });
    expect(result?.status).toBe('done');
    const output = result?.result as { slices: Array<{ baseSlice: string }> };
    const bases = output.slices.map((s) => s.baseSlice);
    expect(bases[0]).toBe('foundation');
    expect(bases).toContain('data_model');
    expect(bases).toContain('list_detail');
    expect(bases).toContain('create_edit');
  });
});
