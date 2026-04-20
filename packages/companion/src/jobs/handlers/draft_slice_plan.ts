import { JobSchemas, slicesForCapabilities, BASE_SLICES, type SlicePlan } from '@viberun/shared';
import type { JobHandler } from '../registry.js';

export const draftSlicePlan: JobHandler<'draft_slice_plan'> = {
  type: 'draft_slice_plan',
  async run(input) {
    // Deterministic derivation: no model call needed. Spec → capabilities →
    // ordered base slices → slice plan. Matches free_path.md "do not let the
    // model freely redesign the whole app during a slice job".
    const ordered = slicesForCapabilities(input.spec.capabilities);
    const plan: SlicePlan = {
      slices: ordered.map((baseSlice, idx) => {
        const def = BASE_SLICES[baseSlice];
        const dependsOn = def.dependsOn
          .map((depId) => `slice-${depId}`)
          .filter((id) => ordered.slice(0, idx).some((prev) => `slice-${prev}` === id));
        return {
          id: `slice-${baseSlice}`,
          baseSlice,
          title: def.title,
          blurb: def.blurb,
          status: 'pending',
          dependsOn,
        };
      }),
    };
    return plan;
  },
};
