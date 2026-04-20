import { z } from 'zod';

// A deploy provider takes a built workspace (dist/ already produced by the
// validation pipeline) and makes it reachable by URL. Two built-ins today:
//
//   - local: companion serves dist/ over its own HTTP port. Zero config. Pair
//     with a tunnel (cloudflared, tailscale, ngrok) to reach from a phone.
//   - firebase: opt-in. Uses firebase-tools CLI hosting preview channels.
//
// Per ADR 0005 this is the third major paid-upgrade seam (after ModelProvider
// and capability set). Vercel/Cloudflare Pages/Netlify are future additions.

export interface DeployResult {
  url: string;
  provider: string;
  channel?: string;
  expiresAt?: string;
}

export interface DeployProvider {
  readonly name: string;
  /**
   * Deploy a project's built dist/ to a preview URL reachable by the user's
   * phone. `workspaceDir` is the per-project workspace under the companion's
   * workspacesDir; `projectId` is the Viberun project id (used as a unique
   * channel/path key).
   */
  deployPreview(args: {
    workspaceDir: string;
    projectId: string;
    appName: string;
  }): Promise<DeployResult>;
}

export const LocalDeployConfigSchema = z.object({
  kind: z.literal('local'),
  // Optional externally-visible base URL. When set, preview links the
  // companion returns to the PWA use this instead of the relative
  // /api/companion path. Expected shape: `https://<tunnel-host>` (no trailing
  // slash). Lets the phone open the preview through a tunnel.
  publicBaseUrl: z.string().url().optional(),
});

export const FirebaseDeployConfigSchema = z.object({
  kind: z.literal('firebase'),
  projectId: z.string().min(1),
  command: z.string().default('firebase'),
  // Deploy as a named preview channel so each Viberun project gets a distinct
  // URL. Defaults to the Viberun projectId, truncated to Firebase's limits.
  channelPrefix: z.string().default('viberun'),
  channelExpires: z.string().default('7d'),
});

export const DeployConfigSchema = z.discriminatedUnion('kind', [
  LocalDeployConfigSchema,
  FirebaseDeployConfigSchema,
]);
export type DeployConfig = z.infer<typeof DeployConfigSchema>;

export class DeployError extends Error {
  constructor(message: string, readonly originalError?: unknown) {
    super(message);
    this.name = 'DeployError';
  }
}
