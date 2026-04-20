import { z } from 'zod';

// Each candidate idea is scored on five dimensions from free_path.md. Only
// ideas with high total score surface to the user.
export const ScoreSchema = z.number().min(0).max(1);

export const IdeaScoresSchema = z.object({
  usefulness: ScoreSchema,
  buildability: ScoreSchema,
  companionSafety: ScoreSchema,
  freeInfraFit: ScoreSchema,
  sliceability: ScoreSchema,
});
export type IdeaScores = z.infer<typeof IdeaScoresSchema>;

export function totalScore(scores: IdeaScores): number {
  return (
    scores.usefulness +
    scores.buildability +
    scores.companionSafety +
    scores.freeInfraFit +
    scores.sliceability
  );
}

// Minimum total score to surface an idea on the free path. Tuned empirically;
// paid tiers may lower this threshold.
export const IDEA_SURFACE_THRESHOLD = 3.5;
