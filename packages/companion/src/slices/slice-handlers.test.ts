import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Spec } from '@viberun/shared';
import { runDataModel } from '../jobs/handlers/implement_slice/data_model.js';
import { runListDetail } from '../jobs/handlers/implement_slice/list_detail.js';
import { runCreateEdit } from '../jobs/handlers/implement_slice/create_edit.js';
import { runCoreScreen } from '../jobs/handlers/implement_slice/core_screen.js';
import { runPolishPublish } from '../jobs/handlers/implement_slice/polish_publish.js';

const spec: Spec = {
  name: 'Reads',
  slug: 'reads',
  pitch: 'Track books.',
  shape: 'record_tracker',
  capabilities: ['landing', 'nav_shell', 'records', 'list', 'detail', 'create_edit', 'states'],
  entities: [
    {
      name: 'Book',
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'notes', type: 'longtext', required: false },
      ],
    },
  ],
  userRoles: ['owner'],
  constraints: [],
};

describe('slice handlers — file contents', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'viberun-test-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('data_model writes store, entities, seed', async () => {
    await runDataModel(dir, spec);
    const entities = await readFile(join(dir, 'src/lib/entities.ts'), 'utf8');
    const store = await readFile(join(dir, 'src/lib/store.ts'), 'utf8');
    const seed = await readFile(join(dir, 'src/lib/seed.ts'), 'utf8');
    const main = await readFile(join(dir, 'src/main.tsx'), 'utf8');
    expect(entities).toContain('export interface Book');
    expect(entities).toContain('bookStore');
    expect(store).toContain('defineStore');
    expect(seed).toContain('seedIfEmpty');
    expect(main).toContain('seedIfEmpty');
  });

  it('list_detail writes List + Detail referencing the entity store', async () => {
    await runListDetail(dir, spec);
    const list = await readFile(join(dir, 'src/screens/List.tsx'), 'utf8');
    const detail = await readFile(join(dir, 'src/screens/Detail.tsx'), 'utf8');
    expect(list).toContain("from '../lib/entities'");
    expect(list).toMatch(/bookStore\s*\.\s*list\(\)/);
    expect(detail).toMatch(/bookStore\s*\.\s*get\(id\)/);
  });

  it('create_edit generates a form with inputs per field', async () => {
    await runCreateEdit(dir, spec);
    const edit = await readFile(join(dir, 'src/screens/Edit.tsx'), 'utf8');
    expect(edit).toContain('bookStore.create');
    expect(edit).toContain('bookStore.update');
    expect(edit).toMatch(/value={String\(draft\.title/);
    expect(edit).toContain('<textarea'); // notes is longtext
  });

  it('core_screen writes Home that lists recent entries', async () => {
    await runCoreScreen(dir, spec);
    const home = await readFile(join(dir, 'src/screens/Home.tsx'), 'utf8');
    expect(home).toMatch(/bookStore\s*\.\s*list\(\)/);
    expect(home).toContain('items.slice(0, 3)');
  });

  it('polish_publish customizes index.html and manifest', async () => {
    await runPolishPublish(dir, spec);
    const html = await readFile(join(dir, 'index.html'), 'utf8');
    const manifest = await readFile(join(dir, 'public/manifest.webmanifest'), 'utf8');
    expect(html).toContain('<title>Reads</title>');
    expect(JSON.parse(manifest).name).toBe('Reads');
  });
});
