import { JobSchemas } from '@viberun/shared';
import type { JobHandler } from '../registry.js';

export const finalizeAppSummary: JobHandler<'finalize_app_summary'> = {
  type: 'finalize_app_summary',
  async run(input, ctx) {
    return ctx.provider.plan({
      jobType: 'finalize_app_summary',
      prompt: JSON.stringify(input),
      schema: JobSchemas.finalize_app_summary.output,
    });
  },
};
