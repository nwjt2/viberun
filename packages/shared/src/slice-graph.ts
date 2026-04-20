import { z } from 'zod';
import type { Capability } from './capabilities.js';

// The 8 base slices from free_path.md. `implement_slice` handlers are keyed by
// this id. Dependencies determine which slices can be offered next.
export const BASE_SLICE_IDS = [
  'foundation',
  'data_model',
  'core_screen',
  'list_detail',
  'create_edit',
  'filter_search_favorites',
  'owner_admin',
  'polish_publish',
] as const;

export type BaseSliceId = (typeof BASE_SLICE_IDS)[number];
export const BaseSliceIdSchema = z.enum(BASE_SLICE_IDS);

export interface BaseSliceDefinition {
  id: BaseSliceId;
  title: string;
  blurb: string;
  dependsOn: BaseSliceId[];
  capabilitiesProvided: Capability[];
  capabilitiesRequired: Capability[];
}

export const BASE_SLICES: Record<BaseSliceId, BaseSliceDefinition> = {
  foundation: {
    id: 'foundation',
    title: 'Foundation',
    blurb: 'App name, colors, typography, nav shell, homepage shell.',
    dependsOn: [],
    capabilitiesProvided: ['landing', 'nav_shell'],
    capabilitiesRequired: [],
  },
  data_model: {
    id: 'data_model',
    title: 'Data model',
    blurb: 'Entities, local typings, Supabase bindings, sample data.',
    dependsOn: ['foundation'],
    capabilitiesProvided: ['records', 'seed_data'],
    capabilitiesRequired: [],
  },
  core_screen: {
    id: 'core_screen',
    title: 'Core screen',
    blurb: 'Main dashboard or landing screen.',
    dependsOn: ['foundation', 'data_model'],
    capabilitiesProvided: ['dashboard'],
    capabilitiesRequired: ['records'],
  },
  list_detail: {
    id: 'list_detail',
    title: 'List + detail',
    blurb: 'List page and detail page.',
    dependsOn: ['data_model'],
    capabilitiesProvided: ['list', 'detail'],
    capabilitiesRequired: ['records'],
  },
  create_edit: {
    id: 'create_edit',
    title: 'Create / edit',
    blurb: 'Add / edit flow.',
    dependsOn: ['data_model'],
    capabilitiesProvided: ['create_edit'],
    capabilitiesRequired: ['records'],
  },
  filter_search_favorites: {
    id: 'filter_search_favorites',
    title: 'Filter + search + favorites',
    blurb: 'Search, filters, favorites or saved items.',
    dependsOn: ['list_detail'],
    capabilitiesProvided: ['search', 'filter', 'favorites'],
    capabilitiesRequired: ['list', 'records'],
  },
  owner_admin: {
    id: 'owner_admin',
    title: 'Owner / admin',
    blurb: 'Owner settings, simple content management, visibility toggles.',
    dependsOn: ['data_model'],
    capabilitiesProvided: ['owner_admin'],
    capabilitiesRequired: ['records'],
  },
  polish_publish: {
    id: 'polish_publish',
    title: 'Polish + publish',
    blurb: 'Empty states, loading states, mobile responsiveness, PWA basics, deployment config.',
    dependsOn: ['foundation'],
    capabilitiesProvided: ['states', 'preview_deploy'],
    capabilitiesRequired: [],
  },
};

/**
 * Returns the subset of base slices whose dependencies are all in `completed`.
 * Excludes slices already completed.
 */
export function validNextSlices(completed: ReadonlyArray<BaseSliceId>): BaseSliceDefinition[] {
  const done = new Set(completed);
  return BASE_SLICE_IDS.map((id) => BASE_SLICES[id]).filter((slice) => {
    if (done.has(slice.id)) return false;
    return slice.dependsOn.every((dep) => done.has(dep));
  });
}

/**
 * Returns a topological order of slices that satisfy the required capability
 * set for a project. Used by `draft_slice_plan` to derive a deterministic plan
 * from the accepted spec; the model only refines labels and titles.
 */
export function slicesForCapabilities(required: ReadonlyArray<Capability>): BaseSliceId[] {
  const need = new Set<Capability>(required);
  const plan: BaseSliceId[] = [];
  const done = new Set<BaseSliceId>();

  // Keep adding slices whose dependencies are done and which contribute at
  // least one needed capability, or which are prerequisites of a needed slice.
  const requiredSlices = BASE_SLICE_IDS.filter((id) =>
    BASE_SLICES[id].capabilitiesProvided.some((cap) => need.has(cap)),
  );
  const reachable = new Set<BaseSliceId>(requiredSlices);
  // Include transitive dependencies.
  let growing = true;
  while (growing) {
    growing = false;
    for (const id of Array.from(reachable)) {
      for (const dep of BASE_SLICES[id].dependsOn) {
        if (!reachable.has(dep)) {
          reachable.add(dep);
          growing = true;
        }
      }
    }
  }

  while (plan.length < reachable.size) {
    const next = BASE_SLICE_IDS.find(
      (id) => reachable.has(id) && !done.has(id) && BASE_SLICES[id].dependsOn.every((d) => done.has(d)),
    );
    if (!next) break;
    plan.push(next);
    done.add(next);
  }
  return plan;
}
