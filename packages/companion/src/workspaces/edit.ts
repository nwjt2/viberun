import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join } from 'node:path';
import { run } from '../util/shell.js';

// File-edit helpers shared by slice handlers. All paths are workspace-relative.

export async function readOptional(workspaceDir: string, rel: string): Promise<string | null> {
  try {
    await access(join(workspaceDir, rel), constants.F_OK);
    return await readFile(join(workspaceDir, rel), 'utf8');
  } catch {
    return null;
  }
}

export async function writeRel(workspaceDir: string, rel: string, contents: string): Promise<void> {
  const full = join(workspaceDir, rel);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, contents, 'utf8');
}

export async function ensureFile(workspaceDir: string, rel: string, defaultContents: string): Promise<void> {
  const existing = await readOptional(workspaceDir, rel);
  if (existing == null) await writeRel(workspaceDir, rel, defaultContents);
}

/**
 * Create a git commit for this slice. Commit message prefixes make git log
 * readable: e.g. `slice(data_model): seed + store`. Returns the short SHA, or
 * undefined if the workspace isn't a git repo.
 */
export async function commitSlice(
  workspaceDir: string,
  slice: string,
  message: string,
): Promise<string | undefined> {
  const add = await run('git', ['add', '-A'], { cwd: workspaceDir });
  if (add.exitCode !== 0) return undefined;
  const commit = await run(
    'git',
    [
      '-c',
      'user.email=companion@viberun.local',
      '-c',
      'user.name=viberun-companion',
      'commit',
      '-q',
      '-m',
      `slice(${slice}): ${message}`,
    ],
    { cwd: workspaceDir },
  );
  if (commit.exitCode !== 0) return undefined;
  const sha = await run('git', ['rev-parse', '--short', 'HEAD'], { cwd: workspaceDir });
  return sha.exitCode === 0 ? sha.stdout.trim() : undefined;
}
