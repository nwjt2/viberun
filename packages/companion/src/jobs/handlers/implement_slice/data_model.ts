import type { Spec, SliceArtifacts } from '@viberun/shared';
import { writeRel, commitSlice } from '../../../workspaces/edit.js';
import { primaryEntity, entityInterface, entityDraftInterface } from '../../../slices/codegen.js';

// Writes the IndexedDB-backed store primitive + entity typings + seed data.
// Generated apps use IndexedDB instead of Supabase so the user can build and
// use a real app with no extra accounts or credentials. This is a documented
// deviation from free_path.md (which says "record-based apps use Supabase")
// — see docs/decisions/0005-indexeddb-store-for-generated-apps.md.

const STORE_SRC = `// Tiny IndexedDB wrapper. One object store per entity. All records carry id
// and createdAt; payloads are stored as-is with structured clone.

export interface StoreRecord {
  id: string;
  createdAt: string;
  [key: string]: unknown;
}

const DB_NAME = 'viberun-generated-app';
const DB_VERSION = 1;
const REGISTERED = new Set<string>();

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of REGISTERED) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDb();
      const store = db.transaction(storeName, mode).objectStore(storeName);
      const req = fn(store);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
}

export interface EntityStore<T extends StoreRecord, Draft> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | null>;
  create(draft: Draft): Promise<T>;
  update(id: string, patch: Partial<Draft>): Promise<T>;
  remove(id: string): Promise<void>;
}

export function defineStore<T extends StoreRecord, Draft>(name: string): EntityStore<T, Draft> {
  REGISTERED.add(name);
  return {
    async list() {
      const rows = (await tx<T[]>(name, 'readonly', (s) => s.getAll() as IDBRequest<T[]>)) ?? [];
      return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },
    async get(id) {
      const row = await tx<T | undefined>(name, 'readonly', (s) => s.get(id) as IDBRequest<T | undefined>);
      return row ?? null;
    },
    async create(draft) {
      const row = { ...(draft as object), id: uuid(), createdAt: new Date().toISOString() } as T;
      await tx(name, 'readwrite', (s) => s.add(row));
      return row;
    },
    async update(id, patch) {
      const existing = await tx<T | undefined>(name, 'readonly', (s) => s.get(id) as IDBRequest<T | undefined>);
      if (!existing) throw new Error(\`no record with id=\${id}\`);
      const updated = { ...existing, ...(patch as object) } as T;
      await tx(name, 'readwrite', (s) => s.put(updated));
      return updated;
    },
    async remove(id) {
      await tx(name, 'readwrite', (s) => s.delete(id));
    },
  };
}
`;

function renderEntitiesFile(spec: Spec): string {
  const entity = primaryEntity(spec);
  const iface = entityInterface(entity);
  const draftIface = entityDraftInterface(entity);
  const storeName = entity.name.toLowerCase();
  return `import { defineStore, type StoreRecord } from './store';

${iface}
${draftIface}

// Cast to StoreRecord to satisfy the generic bound. ${entity.name} adds its
// own fields; id and createdAt come from StoreRecord.
export const ${storeName}Store = defineStore<${entity.name} & StoreRecord, ${entity.name}Draft>(${JSON.stringify(storeName)});
`;
}

function renderSeedFile(spec: Spec): string {
  const entity = primaryEntity(spec);
  const storeName = entity.name.toLowerCase();
  const sampleDrafts = sampleRows(spec);
  return `import { ${storeName}Store } from './entities';

const SEED_KEY = 'viberun-generated-app:seeded';

export async function seedIfEmpty(): Promise<void> {
  if (typeof localStorage !== 'undefined' && localStorage.getItem(SEED_KEY)) return;
  const existing = await ${storeName}Store.list();
  if (existing.length > 0) {
    if (typeof localStorage !== 'undefined') localStorage.setItem(SEED_KEY, '1');
    return;
  }
  const drafts = ${JSON.stringify(sampleDrafts, null, 2)};
  for (const draft of drafts) {
    await ${storeName}Store.create(draft);
  }
  if (typeof localStorage !== 'undefined') localStorage.setItem(SEED_KEY, '1');
}
`;
}

function sampleRows(spec: Spec): Array<Record<string, unknown>> {
  const entity = primaryEntity(spec);
  const sampleBaseValues: Array<Array<string | number | boolean>> = [
    ['First one', 'Got started.', true],
    ['Second one', 'Keep going.', true],
    ['Third one', 'Nearly done.', false],
  ];
  return sampleBaseValues.map((base, idx) => {
    const row: Record<string, unknown> = {};
    for (let i = 0; i < entity.fields.length; i++) {
      const field = entity.fields[i]!;
      const pick = base[i % base.length];
      switch (field.type) {
        case 'text':
        case 'longtext':
        case 'url':
          row[field.name] = typeof pick === 'string' ? pick : `Sample ${idx + 1}`;
          break;
        case 'number':
          row[field.name] = typeof pick === 'number' ? pick : idx + 1;
          break;
        case 'boolean':
          row[field.name] = typeof pick === 'boolean' ? pick : idx % 2 === 0;
          break;
        case 'date':
          row[field.name] = new Date(Date.now() - idx * 86400000).toISOString().slice(0, 10);
          break;
        case 'enum':
          row[field.name] = field.enumValues?.[idx % (field.enumValues?.length || 1)] ?? '';
          break;
      }
    }
    return row;
  });
}

const MAIN_PATCH = `import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { seedIfEmpty } from './lib/seed';
import './styles.css';

void seedIfEmpty();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
`;

export async function runDataModel(workspaceDir: string, spec: Spec): Promise<Partial<SliceArtifacts>> {
  await writeRel(workspaceDir, 'src/lib/store.ts', STORE_SRC);
  await writeRel(workspaceDir, 'src/lib/entities.ts', renderEntitiesFile(spec));
  await writeRel(workspaceDir, 'src/lib/seed.ts', renderSeedFile(spec));
  await writeRel(workspaceDir, 'src/main.tsx', MAIN_PATCH);
  const sha = await commitSlice(workspaceDir, 'data_model', `store + ${primaryEntity(spec).name} entity + seed`);
  return {
    commitSha: sha,
    filesWritten: ['src/lib/store.ts', 'src/lib/entities.ts', 'src/lib/seed.ts', 'src/main.tsx'],
    summary: `Data model is in. The app stores ${primaryEntity(spec).name.toLowerCase()} records locally with three sample entries seeded.`,
    whatYouCanDo: [`See 3 sample ${primaryEntity(spec).name.toLowerCase()} entries when the list is wired up`],
    whatRemains: ['List + detail screens', 'Create / edit form', 'Polish + deploy'],
  };
}
