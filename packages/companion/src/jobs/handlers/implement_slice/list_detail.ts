import type { Spec, SliceArtifacts } from '@viberun/shared';
import { writeRel, commitSlice } from '../../../workspaces/edit.js';
import { primaryEntity, labelFor } from '../../../slices/codegen.js';

function renderListScreen(spec: Spec): string {
  const entity = primaryEntity(spec);
  const storeName = entity.name.toLowerCase();
  const displayField = entity.fields.find((f) => f.type === 'text') ?? entity.fields[0]!;
  return `import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { Loading } from '../components/Loading';
import { ErrorState } from '../components/ErrorState';
import { ${storeName}Store, type ${entity.name} } from '../lib/entities';

export function List() {
  const [items, setItems] = useState<${entity.name}[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    ${storeName}Store
      .list()
      .then(setItems)
      .catch(setError);
  }, []);

  if (error) return <ErrorState error={error} />;
  if (items == null) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">${entity.name}s</h2>
        <Link to="/items/new" className="rounded-lg bg-white text-slate-900 px-3 py-1.5 text-sm font-medium">
          New
        </Link>
      </div>
      {items.length === 0 ? (
        <EmptyState title="No ${entity.name.toLowerCase()}s yet" blurb="Add your first one to get started." />
      ) : (
        <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
          {items.map((item) => (
            <li key={item.id} className="p-3">
              <Link to={\`/items/\${item.id}\`} className="flex justify-between">
                <span>{String(item.${displayField.name} ?? item.id)}</span>
                <span className="text-slate-500 text-sm">{item.createdAt.slice(0, 10)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
`;
}

function renderDetailScreen(spec: Spec): string {
  const entity = primaryEntity(spec);
  const storeName = entity.name.toLowerCase();
  const displayField = entity.fields.find((f) => f.type === 'text') ?? entity.fields[0]!;
  const fieldRows = entity.fields
    .map(
      (f) =>
        `        <div>
          <dt className="text-slate-500 text-sm">${labelFor(f)}</dt>
          <dd>{String(item.${f.name} ?? '—')}</dd>
        </div>`,
    )
    .join('\n');
  return `import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { Loading } from '../components/Loading';
import { ErrorState } from '../components/ErrorState';
import { ${storeName}Store, type ${entity.name} } from '../lib/entities';

export function Detail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<${entity.name} | null | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!id) return;
    ${storeName}Store
      .get(id)
      .then(setItem)
      .catch(setError);
  }, [id]);

  if (error) return <ErrorState error={error} />;
  if (item === undefined) return <Loading />;
  if (item == null)
    return (
      <EmptyState
        title="Not found"
        blurb="That entry may have been deleted."
        action={<Link to="/items" className="underline">Back to list</Link>}
      />
    );

  return (
    <div className="space-y-4">
      <Link to="/items" className="text-sm text-slate-400">← Back</Link>
      <h2 className="text-xl font-semibold">{String(item.${displayField.name} ?? '')}</h2>
      <dl className="space-y-3">
${fieldRows}
      </dl>
      <div className="flex gap-3">
        <Link
          to={\`/items/\${item.id}/edit\`}
          className="rounded-lg bg-slate-800 text-white px-3 py-1.5 text-sm font-medium"
        >
          Edit
        </Link>
        <button
          onClick={async () => {
            await ${storeName}Store.remove(item.id);
            navigate('/items');
          }}
          className="rounded-lg bg-red-900/50 text-red-200 px-3 py-1.5 text-sm font-medium"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
`;
}

export async function runListDetail(workspaceDir: string, spec: Spec): Promise<Partial<SliceArtifacts>> {
  const entity = primaryEntity(spec);
  await writeRel(workspaceDir, 'src/screens/List.tsx', renderListScreen(spec));
  await writeRel(workspaceDir, 'src/screens/Detail.tsx', renderDetailScreen(spec));
  const sha = await commitSlice(workspaceDir, 'list_detail', `browse + view ${entity.name}s`);
  return {
    commitSha: sha,
    filesWritten: ['src/screens/List.tsx', 'src/screens/Detail.tsx'],
    summary: `List and detail screens are live. You can browse your ${entity.name.toLowerCase()}s and open each one.`,
    whatYouCanDo: [
      `See every ${entity.name.toLowerCase()} on the list screen`,
      `Tap one to see its full details`,
      `Delete an entry from the detail screen`,
    ],
    whatRemains: ['Create / edit form', 'Polish + deploy'],
  };
}
