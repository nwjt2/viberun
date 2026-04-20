import { Registry } from '../registry.js';
import { generateIdeaOptions } from './generate_idea_options.js';
import { normalizeCustomIdea } from './normalize_custom_idea.js';
import { askNextClarifyingQuestion } from './ask_next_clarifying_question.js';
import { draftHighLevelSpec } from './draft_high_level_spec.js';
import { reviseHighLevelSpec } from './revise_high_level_spec.js';
import { draftSlicePlan } from './draft_slice_plan.js';
import { reviseSlicePlan } from './revise_slice_plan.js';
import { getValidNextSlices } from './get_valid_next_slices.js';
import { askSliceSpecificQuestion } from './ask_slice_specific_question.js';
import { implementSlice } from './implement_slice.js';
import { reviseSlice } from './revise_slice.js';
import { finalizeAppSummary } from './finalize_app_summary.js';

export function buildRegistry(): Registry {
  const registry = new Registry();
  registry.register(generateIdeaOptions);
  registry.register(normalizeCustomIdea);
  registry.register(askNextClarifyingQuestion);
  registry.register(draftHighLevelSpec);
  registry.register(reviseHighLevelSpec);
  registry.register(draftSlicePlan);
  registry.register(reviseSlicePlan);
  registry.register(getValidNextSlices);
  registry.register(askSliceSpecificQuestion);
  registry.register(implementSlice);
  registry.register(reviseSlice);
  registry.register(finalizeAppSummary);
  return registry;
}
