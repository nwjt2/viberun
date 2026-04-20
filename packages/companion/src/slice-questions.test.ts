import { describe, it, expect } from 'vitest';
import { askSliceSpecificQuestion } from './jobs/handlers/ask_slice_specific_question.js';
import type { JobContext } from './jobs/registry.js';
import { mockProvider } from './model/providers/mock.js';
import { makeDeployProvider } from './deploy/index.js';
import { logger } from './util/logger.js';
import type { Spec } from '@viberun/shared';
import type { CompanionConfig } from './config.js';

const spec: Spec = {
  name: 'App',
  slug: 'app',
  pitch: 'p',
  shape: 'record_tracker',
  capabilities: ['landing'],
  entities: [{ name: 'X', fields: [{ name: 'title', type: 'text', required: true }] }],
  userRoles: ['owner'],
  constraints: [],
};
const cfg: CompanionConfig = {
  mode: 'local',
  provider: { kind: 'mock' },
  workspacesDir: '/tmp/viberun-noop',
  deviceLabel: 't',
  localPort: 4002,
  deploy: { kind: 'local' },
};
const ctx: JobContext = {
  provider: mockProvider,
  deploy: makeDeployProvider(cfg.deploy),
  logger,
  config: cfg,
  heartbeat: async () => {},
};

describe('askSliceSpecificQuestion', () => {
  it('returns done=true for slices with no questions', async () => {
    const result = await askSliceSpecificQuestion.run(
      { spec, baseSlice: 'data_model', answeredQuestions: [] },
      ctx,
    );
    expect(result.done).toBe(true);
  });

  it('asks list_detail sort question, then done after answered', async () => {
    const first = await askSliceSpecificQuestion.run(
      { spec, baseSlice: 'list_detail', answeredQuestions: [] },
      ctx,
    );
    expect(first.done).toBe(false);
    expect(first.question.toLowerCase()).toContain('sort');
    const second = await askSliceSpecificQuestion.run(
      {
        spec,
        baseSlice: 'list_detail',
        answeredQuestions: [{ question: first.question, answer: 'Newest first' }],
      },
      ctx,
    );
    expect(second.done).toBe(true);
  });
});
