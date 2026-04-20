import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { JobTypeSchema, type JobType } from '@viberun/shared';
import { LocalJobQueue } from './queue/local.js';
import type { Logger } from './util/logger.js';
import type { UsageMeter } from './model/rate-limit.js';

export interface LocalServerOptions {
  queue: LocalJobQueue;
  port: number;
  workspacesDir: string;
  logger: Logger;
  usageMeter?: UsageMeter;
  rateLimit?: { rpm?: number; dailyLimit?: number };
  providerKind?: string;
}

// Minimal HTTP facade over LocalJobQueue for in-container dev, plus static
// serving of each project's built dist/ at /preview/<projectId>/. The mobile
// PWA talks to this via fetch. Same origin + Vite's /api/companion proxy in
// dev; same origin over a tunnel (cloudflared/tailscale/ngrok) from a phone.
export function startLocalServer(options: LocalServerOptions): { close: () => Promise<void> } {
  const { queue, port, workspacesDir, logger, usageMeter, rateLimit, providerKind } = options;
  const server = createServer((req, res) => {
    void handle(req, res, { queue, workspacesDir, logger, usageMeter, rateLimit, providerKind }).catch(
      (err) => {
        logger.error({ err }, 'local-server request failed');
        sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
      },
    );
  });
  // Bind to all interfaces (IPv4 + IPv6) explicitly. Node's default behavior
  // varies: some environments bind only IPv4, so cloudflared (which prefers
  // `::1` when resolving `localhost`) hits "connection refused". '::' with
  // dual-stack enabled accepts both v6 and v4 connections.
  server.listen(port, '::', () => {
    logger.info({ port, workspacesDir }, 'local-server listening (dual-stack)');
  });
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EAFNOSUPPORT' || err.code === 'EADDRNOTAVAIL') {
      // IPv6 not available — fall back to IPv4 only.
      logger.warn({ err: err.message }, 'IPv6 bind failed; falling back to 0.0.0.0');
      server.listen(port, '0.0.0.0', () => {
        logger.info({ port, workspacesDir }, 'local-server listening (ipv4 only)');
      });
    }
  });
  return {
    async close() {
      await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    },
  };
}

interface HandlerDeps {
  queue: LocalJobQueue;
  workspacesDir: string;
  logger: Logger;
  usageMeter?: UsageMeter;
  rateLimit?: { rpm?: number; dailyLimit?: number };
  providerKind?: string;
}

async function handle(req: IncomingMessage, res: ServerResponse, deps: HandlerDeps) {
  const origin = req.headers.origin ?? '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/healthz') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/usage') {
    const snapshot = deps.usageMeter ? await deps.usageMeter.snapshot() : null;
    sendJson(res, 200, {
      provider: deps.providerKind ?? 'unknown',
      rpm: deps.rateLimit?.rpm ?? null,
      dailyLimit: deps.rateLimit?.dailyLimit ?? null,
      today: snapshot
        ? { date: snapshot.date, count: snapshot.count }
        : { date: new Date().toISOString().slice(0, 10), count: 0 },
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/jobs') {
    sendJson(res, 200, { jobs: deps.queue.list() });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/jobs') {
    const body = await readBody(req);
    const parsed = JSON.parse(body) as { userId?: string; projectId?: string | null; type?: string; payload?: unknown };
    const type = JobTypeSchema.safeParse(parsed.type);
    if (!type.success) {
      sendJson(res, 400, { error: `invalid job type: ${parsed.type}` });
      return;
    }
    const envelope = await deps.queue.enqueue({
      userId: parsed.userId ?? 'local-user',
      projectId: parsed.projectId ?? null,
      type: type.data as JobType,
      payload: parsed.payload,
    });
    sendJson(res, 200, envelope);
    return;
  }

  const jobMatch = /^\/jobs\/([^/]+)$/.exec(url.pathname);
  if (req.method === 'GET' && jobMatch) {
    const id = jobMatch[1]!;
    const job = await deps.queue.get(id);
    if (!job) {
      sendJson(res, 404, { error: 'not found' });
      return;
    }
    sendJson(res, 200, job);
    return;
  }

  // /preview/<projectId>/<path> — serve the project's built dist/.
  const previewMatch = /^\/preview\/([^/]+)(\/.*)?$/.exec(url.pathname);
  if (req.method === 'GET' && previewMatch) {
    const projectId = decodeURIComponent(previewMatch[1]!);
    const suffix = previewMatch[2] ?? '/';
    await servePreview(res, deps, projectId, suffix);
    return;
  }

  // /projects/<id> — GET workspace status for a given project id. Used by the
  // PWA to detect workspace-gone-from-laptop and offer a clean reset.
  const projectMatch = /^\/projects\/([^/]+)$/.exec(url.pathname);
  if (req.method === 'GET' && projectMatch) {
    const projectId = decodeURIComponent(projectMatch[1]!);
    const target = resolve(deps.workspacesDir, projectId);
    try {
      const st = await stat(target);
      if (!st.isDirectory()) {
        sendJson(res, 404, { exists: false });
        return;
      }
      const distExists = await stat(join(target, 'dist'))
        .then((s) => s.isDirectory())
        .catch(() => false);
      sendJson(res, 200, { exists: true, hasDist: distExists });
    } catch {
      sendJson(res, 404, { exists: false });
    }
    return;
  }

  sendJson(res, 404, { error: `no route for ${req.method} ${url.pathname}` });
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.map': 'application/json; charset=utf-8',
};

async function servePreview(res: ServerResponse, deps: HandlerDeps, projectId: string, suffix: string) {
  const distRoot = resolve(deps.workspacesDir, projectId, 'dist');
  // Defend against traversal: reject any decoded segment that is literally
  // `..`. Defense-in-depth below: also verify the resolved path stays inside
  // distRoot.
  const decoded = decodeURIComponent(suffix).replace(/^[\\/]+/, '');
  const segments = decoded.split(/[\\/]/);
  if (segments.some((s) => s === '..')) {
    sendJson(res, 400, { error: 'bad path' });
    return;
  }
  const requestedRel = normalize(decoded);
  const target = resolve(distRoot, requestedRel);
  if (!target.startsWith(distRoot + sep) && target !== distRoot) {
    sendJson(res, 400, { error: 'bad path' });
    return;
  }

  let fileTarget = target;
  try {
    const st = await stat(fileTarget);
    if (st.isDirectory()) fileTarget = join(fileTarget, 'index.html');
  } catch {
    // File not found — SPA fallback: serve dist/index.html so client-side
    // routes in the generated app work.
    fileTarget = join(distRoot, 'index.html');
  }

  try {
    const st = await stat(fileTarget);
    const ext = extname(fileTarget);
    res.writeHead(200, {
      'content-type': MIME[ext] ?? 'application/octet-stream',
      'content-length': String(st.size),
      // Short cache — slice rebuilds happen often during a session.
      'cache-control': 'no-store',
    });
    createReadStream(fileTarget).pipe(res);
  } catch (err) {
    sendJson(res, 404, { error: `no dist for project ${projectId}. Build a slice first.` });
    deps.logger.debug({ err, fileTarget }, 'preview serve failed');
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
