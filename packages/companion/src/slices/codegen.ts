import type { Entity, EntityField, Spec } from '@viberun/shared';

// Helpers for rendering code from a Spec. Intentionally plain string
// templates — see free_path.md "keep prompts deterministic / do not let the
// model freely redesign the whole app during a slice job".

export function primaryEntity(spec: Spec): Entity {
  const first = spec.entities[0];
  if (!first) throw new Error('spec has no entities');
  return first;
}

export function tsTypeFor(field: EntityField): string {
  switch (field.type) {
    case 'text':
    case 'longtext':
    case 'url':
    case 'date':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'enum':
      return field.enumValues?.map((v) => JSON.stringify(v)).join(' | ') ?? 'string';
  }
}

export function inputTypeFor(field: EntityField): { type: string; attrs?: string } {
  switch (field.type) {
    case 'text':
    case 'url':
      return { type: 'text' };
    case 'longtext':
      return { type: 'textarea' };
    case 'number':
      return { type: 'number' };
    case 'boolean':
      return { type: 'checkbox' };
    case 'date':
      return { type: 'date' };
    case 'enum':
      return { type: 'select' };
  }
}

export function labelFor(field: EntityField): string {
  return field.label ?? field.name.charAt(0).toUpperCase() + field.name.slice(1);
}

export function defaultFor(field: EntityField): string {
  switch (field.type) {
    case 'text':
    case 'longtext':
    case 'url':
      return "''";
    case 'number':
      return '0';
    case 'boolean':
      return 'false';
    case 'date':
      return 'new Date().toISOString().slice(0, 10)';
    case 'enum':
      return field.enumValues?.[0] ? JSON.stringify(field.enumValues[0]) : "''";
  }
}

export function entityInterface(entity: Entity): string {
  const fields = entity.fields
    .map((f) => `  ${f.name}${f.required ? '' : '?'}: ${tsTypeFor(f)};`)
    .join('\n');
  return `export interface ${entity.name} {\n  id: string;\n  createdAt: string;\n${fields}\n}`;
}

export function entityDraftInterface(entity: Entity): string {
  const fields = entity.fields
    .map((f) => `  ${f.name}${f.required ? '' : '?'}: ${tsTypeFor(f)};`)
    .join('\n');
  return `export interface ${entity.name}Draft {\n${fields}\n}`;
}
