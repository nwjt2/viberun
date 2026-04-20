import { mkdir, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { run } from '../util/shell.js';
import { logger } from '../util/logger.js';
import { copyTemplate, type Placeholders } from './template.js';

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export interface ProjectWorkspace {
  projectId: string;
  dir: string;
  isNew: boolean;
}

/**
 * Ensure a per-project workspace exists under the configured workspacesDir.
 * If it's new, copy the generated-template in and init git. If it already
 * exists, leave it alone and return it.
 */
export async function ensureProjectWorkspace(
  projectId: string,
  workspacesDir: string,
  placeholders: Placeholders,
): Promise<ProjectWorkspace> {
  const dir = join(workspacesDir, projectId);
  if (await exists(dir)) {
    return { projectId, dir, isNew: false };
  }
  await mkdir(dir, { recursive: true });
  logger.info({ dir }, 'creating project workspace');
  await copyTemplate(dir, placeholders);

  // Initialize git so downstream slices can commit their changes.
  const gitInit = await run('git', ['init', '-q', '-b', 'main'], { cwd: dir });
  if (gitInit.exitCode !== 0) {
    logger.warn({ stderr: gitInit.stderr }, 'git init failed; continuing without VCS');
  } else {
    await run('git', ['add', '-A'], { cwd: dir });
    await run(
      'git',
      ['-c', 'user.email=companion@viberun.local', '-c', 'user.name=viberun-companion', 'commit', '-q', '-m', 'foundation: initial template'],
      { cwd: dir },
    );
  }

  return { projectId, dir, isNew: true };
}
