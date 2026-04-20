import { describe, it, expect } from 'vitest';
import type { Spec } from '@viberun/shared';
import { primaryEntity, entityInterface, tsTypeFor, inputTypeFor, defaultFor } from './codegen.js';

const spec: Spec = {
  name: 'Reads',
  slug: 'reads',
  pitch: 'Track books.',
  shape: 'record_tracker',
  capabilities: ['landing', 'nav_shell', 'records', 'list', 'detail', 'create_edit', 'states'],
  entities: [
    {
      name: 'Book',
      fields: [
        { name: 'title', type: 'text', required: true, label: 'Title' },
        { name: 'notes', type: 'longtext', required: false },
        { name: 'rating', type: 'number', required: false },
        { name: 'finished', type: 'boolean', required: true },
        { name: 'readOn', type: 'date', required: true },
        { name: 'category', type: 'enum', required: false, enumValues: ['fiction', 'non-fiction'] },
      ],
    },
  ],
  userRoles: ['owner'],
  constraints: [],
};

describe('codegen', () => {
  it('primaryEntity returns first entity', () => {
    expect(primaryEntity(spec).name).toBe('Book');
  });

  it('tsTypeFor maps each field type to valid TS', () => {
    const fields = spec.entities[0]!.fields;
    expect(tsTypeFor(fields[0]!)).toBe('string'); // text
    expect(tsTypeFor(fields[1]!)).toBe('string'); // longtext
    expect(tsTypeFor(fields[2]!)).toBe('number');
    expect(tsTypeFor(fields[3]!)).toBe('boolean');
    expect(tsTypeFor(fields[4]!)).toBe('string'); // date
    expect(tsTypeFor(fields[5]!)).toBe('"fiction" | "non-fiction"');
  });

  it('inputTypeFor maps to form control types', () => {
    const fields = spec.entities[0]!.fields;
    expect(inputTypeFor(fields[0]!).type).toBe('text');
    expect(inputTypeFor(fields[1]!).type).toBe('textarea');
    expect(inputTypeFor(fields[3]!).type).toBe('checkbox');
    expect(inputTypeFor(fields[5]!).type).toBe('select');
  });

  it('defaultFor emits valid TS literal or expression', () => {
    const fields = spec.entities[0]!.fields;
    expect(defaultFor(fields[0]!)).toBe("''");
    expect(defaultFor(fields[2]!)).toBe('0');
    expect(defaultFor(fields[3]!)).toBe('false');
    expect(defaultFor(fields[5]!)).toBe('"fiction"');
  });

  it('entityInterface includes id + createdAt + all fields', () => {
    const iface = entityInterface(spec.entities[0]!);
    expect(iface).toContain('id: string');
    expect(iface).toContain('createdAt: string');
    expect(iface).toContain('title: string');
    expect(iface).toContain('notes?: string');
    expect(iface).toContain('rating?: number');
    expect(iface).toContain('finished: boolean');
  });
});
