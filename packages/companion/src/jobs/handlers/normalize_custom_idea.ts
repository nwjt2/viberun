import { JobSchemas } from '@viberun/shared';
import type { JobHandler } from '../registry.js';

export const normalizeCustomIdea: JobHandler<'normalize_custom_idea'> = {
  type: 'normalize_custom_idea',
  async run(input, ctx) {
    return ctx.provider.plan({
      jobType: 'normalize_custom_idea',
      prompt: JSON.stringify(input),
      schema: JobSchemas.normalize_custom_idea.output,
    });
  },
};
