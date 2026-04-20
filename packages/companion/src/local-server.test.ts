import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalJobQueue } from './queue/local.js';
import { startLocalServer } from './local-server.js';
import { logger } from './util/logger.js';

let workspacesDir: string;
let server: { close: () => Promise<void> };
const PORT = 4099;

beforeEach(async () => {
  workspacesDir = await mkdtemp(join(tmpdir(), 'viberun-server-test-'));
  server = startLocalServer({
    queue: new LocalJobQueue(),
    port: PORT,
    workspacesDir,
    logger,
  });
});

afterEach(async () => {
  await server.close();
  await rm(workspacesDir, { recursive: true, force: true });
});

describe('local-server preview route', () => {
  it('returns 404 for a project with no workspace', async () => {
    const res = await fetch(`http://localhost:${PORT}/projects/unknown`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { exists: boolean };
    expect(body.exists).toBe(false);
  });

  it('reports exists + hasDist when the workspace has a dist', async () => {
    const projectDir = join(workspacesDir, 'myproj');
    await mkdir(join(projectDir, 'dist'), { recursive: true });
    await writeFile(join(projectDir, 'dist', 'index.html'), '<h1>hi</h1>', 'utf8');

    const statusRes = await fetch(`http://localhost:${PORT}/projects/myproj`);
    expect(statusRes.status).toBe(200);
    const status = (await statusRes.json()) as { exists: boolean; hasDist: boolean };
    expect(status).toEqual({ exists: true, hasDist: true });
  });

  it('serves index.html for /preview/<id>/', async () => {
    const projectDir = join(workspacesDir, 'myproj');
    await mkdir(join(projectDir, 'dist'), { recursive: true });
    await writeFile(join(projectDir, 'dist', 'index.html'), '<h1>hi</h1>', 'utf8');

    const res = await fetch(`http://localhost:${PORT}/preview/myproj/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toContain('<h1>hi</h1>');
  });

  it('falls back to index.html for unknown inner paths (SPA)', async () => {
    const projectDir = join(workspacesDir, 'myproj');
    await mkdir(join(projectDir, 'dist'), { recursive: true });
    await writeFile(join(projectDir, 'dist', 'index.html'), '<h1>spa</h1>', 'utf8');

    const res = await fetch(`http://localhost:${PORT}/preview/myproj/deep/nested/route`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<h1>spa</h1>');
  });

  it('rejects path traversal', async () => {
    const projectDir = join(workspacesDir, 'myproj');
    await mkdir(join(projectDir, 'dist'), { recursive: true });
    await writeFile(join(projectDir, 'dist', 'index.html'), 'ok', 'utf8');

    const res = await fetch(`http://localhost:${PORT}/preview/myproj/..%2F..%2Fetc%2Fpasswd`);
    expect(res.status).toBe(400);
  });
});
