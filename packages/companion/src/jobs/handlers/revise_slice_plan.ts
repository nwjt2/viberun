import { JobSchemas } from '@viberun/shared';
import type { JobHandler } from '../registry.js';

export const reviseSlicePlan: JobHandler<'revise_slice_plan'> = {
  type: 'revise_slice_plan',
  async run(input, ctx) {
    return ctx.provider.plan({
      jobType: 'revise_slice_plan',
      prompt: JSON.stringify(input),
      schema: JobSchemas.revise_slice_plan.output,
    });
  },
};
