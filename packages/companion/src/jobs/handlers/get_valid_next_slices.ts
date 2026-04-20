import {
  JobSchemas,
  BASE_SLICES,
  validNextSlices,
  type BaseSliceId,
} from '@viberun/shared';
import type { JobHandler } from '../registry.js';

export const getValidNextSlices: JobHandler<'get_valid_next_slices'> = {
  type: 'get_valid_next_slices',
  async run(input) {
    // Pure: no model call. Map completed slice ids back to baseSlice, then
    // derive valid next slices from the graph.
    const completedBase: BaseSliceId[] = input.completedSliceIds
      .map((id) => input.plan.slices.find((s) => s.id === id)?.baseSlice)
      .filter((b): b is BaseSliceId => b != null);
    const planBases = new Set(input.plan.slices.map((s) => s.baseSlice));
    const candidates = validNextSlices(completedBase).filter((s) => planBases.has(s.id));
    return {
      next: candidates.slice(0, 2).map((slice) => ({
        baseSlice: slice.id,
        title: BASE_SLICES[slice.id].title,
        blurb: BASE_SLICES[slice.id].blurb,
      })),
    };
  },
};
