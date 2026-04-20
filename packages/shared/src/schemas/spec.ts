import { z } from 'zod';
import { AppShapeSchema, CapabilitySchema } from '../capabilities.js';

export const EntityFieldSchema = z.object({
  name: z.string().regex(/^[a-z][a-zA-Z0-9_]*$/),
  type: z.enum(['text', 'longtext', 'number', 'boolean', 'date', 'url', 'enum']),
  required: z.boolean(),
  enumValues: z.array(z.string()).optional(),
  label: z.string().optional(),
});
export type EntityField = z.infer<typeof EntityFieldSchema>;

export const EntitySchema = z.object({
  name: z.string().regex(/^[A-Z][a-zA-Z0-9]*$/), // PascalCase
  fields: z.array(EntityFieldSchema).min(1),
});
export type Entity = z.infer<typeof EntitySchema>;

export const SpecSchema = z.object({
  name: z.string().min(1).max(40), // app name
  slug: z.string().regex(/^[a-z][a-z0-9-]*$/),
  pitch: z.string().min(1).max(280),
  shape: AppShapeSchema,
  capabilities: z.array(CapabilitySchema).min(1),
  entities: z.array(EntitySchema).min(1),
  userRoles: z.array(z.enum(['owner', 'member', 'visitor'])).min(1),
  constraints: z.array(z.string()),
});
export type Spec = z.infer<typeof SpecSchema>;
