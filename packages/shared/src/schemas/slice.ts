import { z } from 'zod';
import { BaseSliceIdSchema } from '../slice-graph.js';

export const SliceStatusSchema = z.enum(['pending', 'in_progress', 'accepted', 'failed']);
export type SliceStatus = z.infer<typeof SliceStatusSchema>;

export const SliceSchema = z.object({
  id: z.string(),
  baseSlice: BaseSliceIdSchema,
  title: z.string(),
  blurb: z.string(),
  status: SliceStatusSchema,
  dependsOn: z.array(z.string()),
});
export type Slice = z.infer<typeof SliceSchema>;

export const SlicePlanSchema = z.object({
  slices: z.array(SliceSchema).min(1),
});
export type SlicePlan = z.infer<typeof SlicePlanSchema>;

export const SliceArtifactsSchema = z.object({
  commitSha: z.string().optional(),
  filesWritten: z.array(z.string()),
  summary: z.string(),
  whatYouCanDo: z.array(z.string()),
  whatRemains: z.array(z.string()),
  // Can be absolute (https://...) or relative (/api/companion/preview/...).
  // The PWA's resolvePreviewUrl() resolves relative forms at click time
  // against the configured companion base URL.
  previewUrl: z.string().min(1).optional(),
});
export type SliceArtifacts = z.infer<typeof SliceArtifactsSchema>;
