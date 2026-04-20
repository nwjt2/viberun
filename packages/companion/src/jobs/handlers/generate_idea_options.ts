import { JobSchemas, IDEA_SURFACE_THRESHOLD, totalScore, type Idea } from '@viberun/shared';
import type { JobHandler } from '../registry.js';

export const generateIdeaOptions: JobHandler<'generate_idea_options'> = {
  type: 'generate_idea_options',
  async run(input, ctx) {
    const prompt = JSON.stringify(input);
    const result = await ctx.provider.plan({
      jobType: 'generate_idea_options',
      prompt,
      schema: JobSchemas.generate_idea_options.output,
    });
    const filtered = result.options.filter((idea: Idea) => totalScore(idea.scores) >= IDEA_SURFACE_THRESHOLD);
    if (filtered.length === 0 && result.options.length > 0) {
      // Provider returned options but none clear the threshold; keep best one so the user isn't stuck.
      const best = [...result.options].sort((a, b) => totalScore(b.scores) - totalScore(a.scores))[0]!;
      return { options: [best] };
    }
    return { options: filtered };
  },
};
