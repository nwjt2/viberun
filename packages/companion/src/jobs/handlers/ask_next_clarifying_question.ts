import { JobSchemas } from '@viberun/shared';
import type { JobHandler } from '../registry.js';

export const askNextClarifyingQuestion: JobHandler<'ask_next_clarifying_question'> = {
  type: 'ask_next_clarifying_question',
  async run(input, ctx) {
    return ctx.provider.plan({
      jobType: 'ask_next_clarifying_question',
      prompt: JSON.stringify(input),
      schema: JobSchemas.ask_next_clarifying_question.output,
    });
  },
};
