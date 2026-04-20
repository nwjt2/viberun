import { describe, it, expect } from 'vitest';
import { validNextSlices, slicesForCapabilities, BASE_SLICES } from './slice-graph.js';

describe('validNextSlices', () => {
  it('returns only foundation when nothing completed', () => {
    const next = validNextSlices([]);
    expect(next.map((s) => s.id)).toEqual(['foundation']);
  });

  it('unblocks data_model after foundation', () => {
    const next = validNextSlices(['foundation']);
    expect(next.map((s) => s.id)).toContain('data_model');
  });

  it('never returns an already-completed slice', () => {
    const next = validNextSlices(['foundation', 'data_model']);
    expect(next.map((s) => s.id)).not.toContain('foundation');
    expect(next.map((s) => s.id)).not.toContain('data_model');
  });

  it('each returned slice has all deps satisfied', () => {
    const completed = ['foundation', 'data_model'] as const;
    const next = validNextSlices(completed);
    for (const slice of next) {
      for (const dep of slice.dependsOn) {
        expect(completed).toContain(dep);
      }
    }
  });
});

describe('slicesForCapabilities', () => {
  it('foundation + list + detail pulls in data_model', () => {
    const plan = slicesForCapabilities(['landing', 'list', 'detail']);
    expect(plan).toContain('foundation');
    expect(plan).toContain('data_model');
    expect(plan).toContain('list_detail');
  });

  it('respects topological order', () => {
    const plan = slicesForCapabilities(['dashboard', 'list', 'detail', 'create_edit']);
    for (let i = 0; i < plan.length; i++) {
      const id = plan[i]!;
      for (const dep of BASE_SLICES[id].dependsOn) {
        expect(plan.slice(0, i)).toContain(dep);
      }
    }
  });
});
