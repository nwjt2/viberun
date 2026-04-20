import { cp, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Locate the generated-template directory relative to this file. Works whether
// this module is running from source (packages/companion/src/workspaces/
// template.ts via tsx) or from dist (packages/companion/dist/workspaces/
// template.js) — both resolve up to the monorepo root. Config override via
// VIBERUN_TEMPLATE_DIR for unusual layouts.
function findTemplateDir(): string {
  if (process.env.VIBERUN_TEMPLATE_DIR) return process.env.VIBERUN_TEMPLATE_DIR;
  const thisFile = fileURLToPath(import.meta.url);
  let cur = dirname(thisFile);
  for (let i = 0; i < 8; i++) {
    const candidate = join(cur, 'apps', 'generated-template');
    if (existsSync(candidate)) return candidate;
    const parent = resolve(cur, '..');
    if (parent === cur) break;
    cur = parent;
  }
  throw new Error(`cannot locate apps/generated-template from ${thisFile}`);
}

const TEXT_FILE_EXTS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.css',
  '.html',
  '.md',
  '.json',
  '.webmanifest',
]);

// Files we never carry into the target workspace.
const EXCLUDE = new Set(['node_modules', 'dist', '.turbo', '.tsbuildinfo']);

async function walk(dir: string, base = dir): Promise<string[]> {
  const entries = await readdir(dir);
  const files: string[] = [];
  for (const entry of entries) {
    if (EXCLUDE.has(entry)) continue;
    const full = join(dir, entry);
    const st = await stat(full);
    if (st.isDirectory()) {
      files.push(...(await walk(full, base)));
    } else {
      files.push(full);
    }
  }
  return files;
}

export interface Placeholders {
  APP_NAME: string;
  APP_SLUG: string;
  APP_PITCH: string;
}

function applyPlaceholders(text: string, p: Placeholders): string {
  return text
    .replaceAll('{{APP_NAME}}', p.APP_NAME)
    .replaceAll('{{APP_SLUG}}', p.APP_SLUG)
    .replaceAll('{{APP_PITCH}}', p.APP_PITCH);
}

export async function copyTemplate(targetDir: string, placeholders: Placeholders): Promise<string[]> {
  const templateDir = findTemplateDir();
  await cp(templateDir, targetDir, {
    recursive: true,
    filter: (src) => {
      const basename = src.split(/[\\/]/).pop() ?? '';
      return !EXCLUDE.has(basename);
    },
  });

  // Rewrite placeholders in text files.
  const written: string[] = [];
  for (const file of await walk(targetDir)) {
    const ext = file.slice(file.lastIndexOf('.'));
    if (!TEXT_FILE_EXTS.has(ext)) continue;
    const original = await readFile(file, 'utf8');
    const replaced = applyPlaceholders(original, placeholders);
    if (replaced !== original) {
      await writeFile(file, replaced, 'utf8');
    }
    written.push(file);
  }

  // Rename package.json's name field to the slug so it's unique.
  const pkgPath = join(targetDir, 'package.json');
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
  pkg.name = placeholders.APP_SLUG;
  pkg.version = '0.0.1';
  pkg.private = true;
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

  return written;
}
