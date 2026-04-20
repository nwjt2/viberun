import type { Spec, SliceArtifacts } from '@viberun/shared';
import { writeRel, commitSlice } from '../../../workspaces/edit.js';
import { primaryEntity } from '../../../slices/codegen.js';

function renderHomeScreen(spec: Spec): string {
  const entity = primaryEntity(spec);
  const storeName = entity.name.toLowerCase();
  const displayField = entity.fields.find((f) => f.type === 'text') ?? entity.fields[0]!;
  return `import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { ${storeName}Store, type ${entity.name} } from '../lib/entities';

export function Home() {
  const [items, setItems] = useState<${entity.name}[] | null>(null);

  useEffect(() => {
    ${storeName}Store.list().then(setItems).catch(() => setItems([]));
  }, []);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{'{{APP_NAME}}'}</h1>
        <p className="text-slate-400">{'{{APP_PITCH}}'}</p>
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent</h2>
          <Link to="/items" className="text-sm text-slate-400 hover:text-white">
            See all
          </Link>
        </div>
        {items == null ? (
          <Loading />
        ) : items.length === 0 ? (
          <EmptyState
            title="Nothing yet"
            blurb="Add your first ${entity.name.toLowerCase()} to get going."
            action={
              <Link
                to="/items/new"
                className="rounded-lg bg-white text-slate-900 px-4 py-2 font-medium inline-block"
              >
                New ${entity.name.toLowerCase()}
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
            {items.slice(0, 3).map((item) => (
              <li key={item.id} className="p-3">
                <Link to={\`/items/\${item.id}\`} className="flex justify-between">
                  <span>{String(item.${displayField.name} ?? item.id)}</span>
                  <span className="text-slate-500 text-sm">{item.createdAt.slice(0, 10)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
`;
}

export async function runCoreScreen(workspaceDir: string, spec: Spec): Promise<Partial<SliceArtifacts>> {
  await writeRel(workspaceDir, 'src/screens/Home.tsx', renderHomeScreen(spec));
  const sha = await commitSlice(workspaceDir, 'core_screen', 'home shows 3 most recent entries');
  return {
    commitSha: sha,
    filesWritten: ['src/screens/Home.tsx'],
    summary: `Home screen now shows your three most recent ${primaryEntity(spec).name.toLowerCase()}s.`,
    whatYouCanDo: ['Open the app and see a quick summary on the home screen'],
    whatRemains: ['Polish + deploy'],
  };
}
