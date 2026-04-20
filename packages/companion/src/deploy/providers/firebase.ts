import { execa } from 'execa';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DeployProvider, DeployResult } from '../provider.js';
import { DeployError } from '../provider.js';

interface FirebaseOptions {
  command: string;
  projectId: string;
  channelPrefix: string;
  channelExpires: string;
}

// Opt-in Firebase Hosting preview channels. Requires:
//   npm i -g firebase-tools
//   firebase login
// and a Firebase project (free Spark plan works). Each Viberun project id
// becomes a named preview channel under the Firebase project, so previews are
// addressable and refreshable on each slice rebuild.

export function makeFirebaseDeployProvider(options: FirebaseOptions): DeployProvider {
  return {
    name: 'firebase',
    async deployPreview({ workspaceDir, projectId, appName }) {
      await ensureFirebaseJson(workspaceDir, options.projectId);

      const channel = channelNameFor(options.channelPrefix, projectId);
      const args = [
        'hosting:channel:deploy',
        channel,
        '--project',
        options.projectId,
        '--expires',
        options.channelExpires,
        '--json',
      ];

      // Reap old preview channels before deploying a new one. Firebase free
      // tier caps channels per site, so orphaned Viberun projects would
      // eventually block new deploys.
      await reapOldChannels(options).catch((err) => {
        // Non-fatal — if listing fails we still try to deploy.
        // eslint-disable-next-line no-console
        console.warn('[firebase] could not reap old channels:', (err as Error).message);
      });

      try {
        const result = await execa(options.command, args, {
          cwd: workspaceDir,
          timeout: 3 * 60_000,
          reject: false,
        });
        if (result.exitCode !== 0) {
          throw new DeployError(
            `firebase CLI exited ${result.exitCode}: ${result.stderr?.toString().slice(-400) ?? ''}`,
          );
        }
        const stdout = result.stdout?.toString() ?? '';
        const url = parseChannelUrl(stdout, options.projectId);
        if (!url) {
          throw new DeployError(
            `firebase deploy for ${appName} succeeded but no preview URL was returned`,
          );
        }
        const deploy: DeployResult = {
          url,
          provider: 'firebase',
          channel,
        };
        return deploy;
      } catch (err) {
        if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
          throw new DeployError(
            `firebase command not found. Install with \`npm i -g firebase-tools\` and run \`firebase login\`.`,
            err,
          );
        }
        if (err instanceof DeployError) throw err;
        throw new DeployError(`firebase deploy failed: ${(err as Error).message}`, err);
      }
    },
  };
}

async function ensureFirebaseJson(workspaceDir: string, projectId: string): Promise<void> {
  // Idempotent: if firebase.json already exists we leave it alone so the user
  // can customize. Otherwise drop in a minimal hosting config pointing at
  // vite's dist/.
  const path = join(workspaceDir, 'firebase.json');
  const existing = await import('node:fs/promises')
    .then((fs) => fs.readFile(path, 'utf8'))
    .catch(() => null);
  if (existing) return;
  const config = {
    hosting: {
      public: 'dist',
      ignore: ['firebase.json', '**/.*', '**/node_modules/**'],
      rewrites: [{ source: '**', destination: '/index.html' }],
    },
  };
  await writeFile(path, JSON.stringify(config, null, 2) + '\n', 'utf8');
  // Also drop a .firebaserc so `firebase use` doesn't prompt.
  const rc = { projects: { default: projectId } };
  await writeFile(join(workspaceDir, '.firebaserc'), JSON.stringify(rc, null, 2) + '\n', 'utf8');
}

/**
 * List preview channels and delete any whose `expireTime` is in the past.
 * Firebase auto-expires channels server-side but surfaced channels may still
 * count against soft caps. Kept best-effort and non-fatal.
 */
async function reapOldChannels(options: FirebaseOptions): Promise<void> {
  const listResult = await execa(
    options.command,
    ['hosting:channel:list', '--project', options.projectId, '--json'],
    { timeout: 60_000, reject: false },
  );
  if (listResult.exitCode !== 0) return;
  const stdout = listResult.stdout?.toString() ?? '';
  type Channel = { name?: string; expireTime?: string };
  let channels: Channel[];
  try {
    const parsed = JSON.parse(stdout.slice(stdout.indexOf('{'), stdout.lastIndexOf('}') + 1)) as {
      result?: { channels?: Channel[] };
    };
    channels = parsed.result?.channels ?? [];
  } catch {
    return;
  }
  const now = Date.now();
  const cutoff = now; // reap anything past its expireTime
  const toDelete = channels.filter(
    (c) => c.expireTime && Date.parse(c.expireTime) < cutoff && !String(c.name ?? '').endsWith('/live'),
  );
  for (const c of toDelete) {
    const name = (c.name ?? '').split('/').pop();
    if (!name) continue;
    await execa(options.command, ['hosting:channel:delete', name, '--project', options.projectId, '--force'], {
      timeout: 60_000,
      reject: false,
    });
  }
}

function channelNameFor(prefix: string, projectId: string): string {
  // Firebase channel names must be lowercase alphanumeric + hyphens, max 20.
  const raw = `${prefix}-${projectId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return raw.slice(0, 20).replace(/-+$/, '');
}

function parseChannelUrl(stdout: string, projectId: string): string | null {
  // Firebase --json output has `{ status: 'success', result: { <siteId>: { url, ... } } }`.
  try {
    const braceStart = stdout.indexOf('{');
    const braceEnd = stdout.lastIndexOf('}');
    if (braceStart < 0 || braceEnd < 0) return null;
    const parsed = JSON.parse(stdout.slice(braceStart, braceEnd + 1)) as {
      result?: Record<string, { url?: string }>;
    };
    const sites = parsed.result ?? {};
    const entry =
      sites[projectId] ??
      Object.values(sites).find((s): s is { url: string } => typeof s?.url === 'string');
    return entry?.url ?? null;
  } catch {
    // Fall back to scraping "Channel URL" from non-JSON output.
    const m = /https?:\/\/[\w.-]+-\w+\.web\.app/.exec(stdout);
    return m?.[0] ?? null;
  }
}
