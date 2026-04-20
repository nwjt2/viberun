import { z } from 'zod';
import { BaseSliceIdSchema } from '../slice-graph.js';
import { IdeaSchema, IdeaOptionsSchema } from './idea.js';
import { SpecSchema } from './spec.js';
import { SlicePlanSchema, SliceArtifactsSchema } from './slice.js';

// The 12 job types from free_path.md. Mobile enqueues one; Companion claims,
// dispatches via registry, and writes the result back.
export const JOB_TYPES = [
  'generate_idea_options',
  'normalize_custom_idea',
  'ask_next_clarifying_question',
  'draft_high_level_spec',
  'revise_high_level_spec',
  'draft_slice_plan',
  'revise_slice_plan',
  'get_valid_next_slices',
  'ask_slice_specific_question',
  'implement_slice',
  'revise_slice',
  'finalize_app_summary',
] as const;

export type JobType = (typeof JOB_TYPES)[number];
export const JobTypeSchema = z.enum(JOB_TYPES);

export const JobStatusSchema = z.enum(['queued', 'claimed', 'running', 'done', 'failed']);
export type JobStatus = z.infer<typeof JobStatusSchema>;

// --- Request payloads -----------------------------------------------------

export const OnboardingHintSchema = z.object({
  background: z.string().optional(),
  appInterests: z.array(z.string()).default([]),
});

export const GenerateIdeaOptionsIn = z.object({
  onboarding: OnboardingHintSchema,
  excludeIds: z.array(z.string()).default([]),
  count: z.number().int().min(1).max(3).default(2),
});

export const NormalizeCustomIdeaIn = z.object({
  transcript: z.string().min(1),
  onboarding: OnboardingHintSchema,
});

export const AskNextClarifyingQuestionIn = z.object({
  draftSpec: SpecSchema.partial(),
  answeredQuestions: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .default([]),
});

export const DraftHighLevelSpecIn = z.object({
  idea: IdeaSchema,
  answers: z.array(z.object({ question: z.string(), answer: z.string() })).default([]),
});

export const ReviseHighLevelSpecIn = z.object({
  previousSpec: SpecSchema,
  revisionTranscript: z.string().min(1),
});

export const DraftSlicePlanIn = z.object({
  spec: SpecSchema,
});

export const ReviseSlicePlanIn = z.object({
  previousPlan: SlicePlanSchema,
  revisionTranscript: z.string().min(1),
});

export const GetValidNextSlicesIn = z.object({
  plan: SlicePlanSchema,
  completedSliceIds: z.array(z.string()).default([]),
});

export const AskSliceSpecificQuestionIn = z.object({
  spec: SpecSchema,
  baseSlice: BaseSliceIdSchema,
  answeredQuestions: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .default([]),
});

export const ImplementSliceIn = z.object({
  projectId: z.string(),
  spec: SpecSchema,
  plan: SlicePlanSchema,
  baseSlice: BaseSliceIdSchema,
  sliceAnswers: z.array(z.object({ question: z.string(), answer: z.string() })).default([]),
});

export const ReviseSliceIn = z.object({
  projectId: z.string(),
  baseSlice: BaseSliceIdSchema,
  previousArtifacts: SliceArtifactsSchema,
  revisionTranscript: z.string().min(1),
});

export const FinalizeAppSummaryIn = z.object({
  spec: SpecSchema,
  plan: SlicePlanSchema,
  sliceSummaries: z.array(z.object({ baseSlice: BaseSliceIdSchema, summary: z.string() })),
});

// --- Response payloads ----------------------------------------------------

export const NextQuestionSchema = z.object({
  question: z.string(),
  suggestedAnswers: z.array(z.string()).max(2),
  done: z.boolean(),
});

// --- Registry of input/output shapes per job type -------------------------

export const JobSchemas = {
  generate_idea_options: { input: GenerateIdeaOptionsIn, output: IdeaOptionsSchema },
  normalize_custom_idea: { input: NormalizeCustomIdeaIn, output: IdeaSchema },
  ask_next_clarifying_question: { input: AskNextClarifyingQuestionIn, output: NextQuestionSchema },
  draft_high_level_spec: { input: DraftHighLevelSpecIn, output: SpecSchema },
  revise_high_level_spec: { input: ReviseHighLevelSpecIn, output: SpecSchema },
  draft_slice_plan: { input: DraftSlicePlanIn, output: SlicePlanSchema },
  revise_slice_plan: { input: ReviseSlicePlanIn, output: SlicePlanSchema },
  get_valid_next_slices: {
    input: GetValidNextSlicesIn,
    output: z.object({
      next: z.array(z.object({ baseSlice: BaseSliceIdSchema, title: z.string(), blurb: z.string() })),
    }),
  },
  ask_slice_specific_question: { input: AskSliceSpecificQuestionIn, output: NextQuestionSchema },
  implement_slice: { input: ImplementSliceIn, output: SliceArtifactsSchema },
  revise_slice: { input: ReviseSliceIn, output: SliceArtifactsSchema },
  finalize_app_summary: {
    input: FinalizeAppSummaryIn,
    output: z.object({ summary: z.string(), whatYouCanDo: z.array(z.string()) }),
  },
} as const;

export type JobInput<T extends JobType> = z.infer<(typeof JobSchemas)[T]['input']>;
export type JobOutput<T extends JobType> = z.infer<(typeof JobSchemas)[T]['output']>;

// --- Envelope (what sits in the jobs table row) ---------------------------

export const JobEnvelopeSchema = z.object({
  id: z.string(),
  userId: z.string(),
  projectId: z.string().nullable(),
  type: JobTypeSchema,
  payload: z.unknown(),
  status: JobStatusSchema,
  result: z.unknown().optional(),
  error: z.string().nullable().optional(),
  retries: z.number().int().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type JobEnvelope = z.infer<typeof JobEnvelopeSchema>;
