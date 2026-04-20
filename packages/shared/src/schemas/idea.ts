import { z } from 'zod';
import { AppShapeSchema, CapabilitySchema } from '../capabilities.js';
import { IdeaScoresSchema } from '../scoring.js';

export const IdeaSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(60),
  oneLiner: z.string().min(1).max(160),
  shape: AppShapeSchema,
  capabilities: z.array(CapabilitySchema).min(1),
  scores: IdeaScoresSchema,
  // When an idea is derived by narrowing a custom voice idea, this carries the
  // user's raw transcript so the model can preserve intent across revisions.
  originTranscript: z.string().optional(),
});
export type Idea = z.infer<typeof IdeaSchema>;

export const IdeaOptionsSchema = z.object({
  options: z.array(IdeaSchema).min(1).max(3),
});
export type IdeaOptions = z.infer<typeof IdeaOptionsSchema>;
