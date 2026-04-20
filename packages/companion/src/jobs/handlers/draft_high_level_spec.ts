import { JobSchemas } from '@viberun/shared';
import type { JobHandler } from '../registry.js';

export const draftHighLevelSpec: JobHandler<'draft_high_level_spec'> = {
  type: 'draft_high_level_spec',
  async run(input, ctx) {
    return ctx.provider.plan({
      jobType: 'draft_high_level_spec',
      prompt: JSON.stringify(input),
      schema: JobSchemas.draft_high_level_spec.output,
    });
  },
};
