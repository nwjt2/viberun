import { JobSchemas } from '@viberun/shared';
import type { JobHandler } from '../registry.js';

export const reviseHighLevelSpec: JobHandler<'revise_high_level_spec'> = {
  type: 'revise_high_level_spec',
  async run(input, ctx) {
    return ctx.provider.plan({
      jobType: 'revise_high_level_spec',
      prompt: JSON.stringify(input),
      schema: JobSchemas.revise_high_level_spec.output,
    });
  },
};
