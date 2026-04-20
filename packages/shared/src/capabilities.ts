import { z } from 'zod';

// Mirrors the "Supported capabilities" list from free_path.md. Adding a new
// capability is one line here plus wiring in slice-graph and scoring. Paid
// upgrades can extend this set without changing consumers.
export const CAPABILITIES = [
  'landing',
  'dashboard',
  'list',
  'detail',
  'create_edit',
  'search',
  'filter',
  'favorites',
  'checklist',
  'journal',
  'directory',
  'intake',
  'booking',
  'records',
  'owner_admin',
  'static_content',
  'auth',
  'nav_shell',
  'states',
  'seed_data',
  'preview_deploy',
] as const;

export type Capability = (typeof CAPABILITIES)[number];
export const CapabilitySchema = z.enum(CAPABILITIES);

// Common project shapes. Determines which seed templates and slice plans are
// offered. Paid tiers may add new shapes here.
export const APP_SHAPES = [
  'record_tracker',
  'intake_request',
  'directory',
  'journal_checklist',
  'dashboard_content',
] as const;

export type AppShape = (typeof APP_SHAPES)[number];
export const AppShapeSchema = z.enum(APP_SHAPES);
