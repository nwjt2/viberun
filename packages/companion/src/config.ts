import { z } from 'zod';
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { logger } from './util/logger.js';
import { DeployConfigSchema, type DeployConfig } from './deploy/provider.js';

// Config is loaded from (in priority order):
//   1. env vars
//   2. ~/.viberun/config.json
//   3. built-in defaults (local mode + mock provider)
//
// Local mode bypasses Supabase entirely and serves the mobile PWA directly
// over a local HTTP port. This is how we develop in-container without the
// user's credentials.

export const ProviderConfigSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('mock') }),
  z.object({ kind: z.literal('echo') }),
  z.object({
    kind: z.literal('gemini-cli'),
    command: z.string().default('gemini'),
    args: z.array(z.string()).default([]),
  }),
]);
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

export const SupabaseConfigSchema = z.object({
  url: z.string().url(),
  anonKey: z.string().min(1),
  refreshToken: z.string().optional(),
});
export type SupabaseConfig = z.infer<typeof SupabaseConfigSchema>;

export const RateLimitConfigSchema = z.object({
  rpm: z.number().int().positive().optional(),
  dailyLimit: z.number().int().positive().optional(),
  meterPath: z.string().optional(),
});
export type RateLimitConfigShape = z.infer<typeof RateLimitConfigSchema>;

export const CompanionConfigSchema = z.object({
  mode: z.enum(['local', 'supabase']).default('local'),
  provider: ProviderConfigSchema.default({ kind: 'mock' }),
  supabase: SupabaseConfigSchema.optional(),
  workspacesDir: z.string().default(''),
  deviceLabel: z.string().default('companion'),
  localPort: z.number().int().positive().default(4000),
  deploy: DeployConfigSchema.default({ kind: 'local' }),
  rateLimit: RateLimitConfigSchema.optional(),
});
export type CompanionConfig = z.infer<typeof CompanionConfigSchema>;
export type { DeployConfig };

function mergedRateLimit(fileConfig: unknown): RateLimitConfigShape | undefined {
  const fileRL = (fileConfig as { rateLimit?: RateLimitConfigShape })?.rateLimit ?? {};
  const envRL: RateLimitConfigShape = {};
  if (process.env.VIBERUN_RATE_RPM) envRL.rpm = Number(process.env.VIBERUN_RATE_RPM);
  if (process.env.VIBERUN_RATE_DAILY) envRL.dailyLimit = Number(process.env.VIBERUN_RATE_DAILY);
  if (process.env.VIBERUN_USAGE_PATH) envRL.meterPath = process.env.VIBERUN_USAGE_PATH;
  const merged = { ...fileRL, ...envRL };
  return Object.keys(merged).length === 0 ? undefined : merged;
}

function defaultWorkspacesDir(): string {
  if (process.env.VIBERUN_WORKSPACES_DIR) return process.env.VIBERUN_WORKSPACES_DIR;
  if (process.env.VIBERUN_MODE === 'local') return join(process.cwd(), '.viberun', 'projects');
  return join(homedir(), '.viberun', 'projects');
}

export function loadConfig(): CompanionConfig {
  const configPath = join(homedir(), '.viberun', 'config.json');
  const fileConfig: unknown = existsSync(configPath)
    ? JSON.parse(readFileSync(configPath, 'utf8'))
    : {};

  const fileDeploy = (fileConfig as { deploy?: unknown }).deploy;
  const envDeploy: DeployConfig | undefined = process.env.VIBERUN_FIREBASE_PROJECT
    ? {
        kind: 'firebase',
        projectId: process.env.VIBERUN_FIREBASE_PROJECT,
        command: process.env.VIBERUN_FIREBASE_COMMAND ?? 'firebase',
        channelPrefix: process.env.VIBERUN_FIREBASE_CHANNEL_PREFIX ?? 'viberun',
        channelExpires: process.env.VIBERUN_FIREBASE_CHANNEL_EXPIRES ?? '7d',
      }
    : process.env.VIBERUN_PUBLIC_BASE_URL
      ? { kind: 'local', publicBaseUrl: process.env.VIBERUN_PUBLIC_BASE_URL }
      : undefined;

  const merged = {
    mode: process.env.VIBERUN_MODE ?? (fileConfig as { mode?: string }).mode ?? 'local',
    provider: process.env.VIBERUN_PROVIDER
      ? { kind: process.env.VIBERUN_PROVIDER as 'mock' | 'echo' | 'gemini-cli' }
      : (fileConfig as { provider?: unknown }).provider ?? { kind: 'mock' },
    supabase:
      process.env.VIBERUN_SUPABASE_URL && process.env.VIBERUN_SUPABASE_ANON_KEY
        ? {
            url: process.env.VIBERUN_SUPABASE_URL,
            anonKey: process.env.VIBERUN_SUPABASE_ANON_KEY,
            refreshToken: process.env.VIBERUN_SUPABASE_REFRESH_TOKEN,
          }
        : (fileConfig as { supabase?: unknown }).supabase,
    workspacesDir: process.env.VIBERUN_WORKSPACES_DIR ?? defaultWorkspacesDir(),
    deviceLabel: process.env.VIBERUN_DEVICE_LABEL ?? 'companion',
    localPort: process.env.VIBERUN_LOCAL_PORT
      ? Number(process.env.VIBERUN_LOCAL_PORT)
      : undefined,
    deploy: envDeploy ?? fileDeploy ?? { kind: 'local' },
    rateLimit: mergedRateLimit(fileConfig),
  };

  const parsed = CompanionConfigSchema.parse(merged);
  if (parsed.mode === 'supabase' && !parsed.supabase) {
    throw new Error(
      'mode=supabase requires VIBERUN_SUPABASE_URL + VIBERUN_SUPABASE_ANON_KEY or ~/.viberun/config.json',
    );
  }
  logger.debug({ mode: parsed.mode, provider: parsed.provider.kind }, 'config loaded');
  return parsed;
}
