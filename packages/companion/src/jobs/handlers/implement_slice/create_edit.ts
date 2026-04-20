import type { Spec, SliceArtifacts } from '@viberun/shared';
import { writeRel, commitSlice } from '../../../workspaces/edit.js';
import { primaryEntity, labelFor, inputTypeFor, defaultFor } from '../../../slices/codegen.js';

function renderEditScreen(spec: Spec): string {
  const entity = primaryEntity(spec);
  const storeName = entity.name.toLowerCase();

  const defaultPairs = entity.fields.map((f) => `    ${f.name}: ${defaultFor(f)},`).join('\n');
  const fieldJsx = entity.fields
    .map((f) => {
      const { type } = inputTypeFor(f);
      const label = labelFor(f);
      const required = f.required ? 'required' : '';
      if (type === 'textarea') {
        return `      <label className="block">
        <span className="block text-sm text-slate-400 mb-1">${label}</span>
        <textarea
          ${required}
          value={String(draft.${f.name} ?? '')}
          onChange={(e) => setDraft({ ...draft, ${f.name}: e.target.value })}
          className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 min-h-24"
        />
      </label>`;
      }
      if (type === 'checkbox') {
        return `      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={Boolean(draft.${f.name})}
          onChange={(e) => setDraft({ ...draft, ${f.name}: e.target.checked })}
          className="h-5 w-5"
        />
        <span className="text-sm text-slate-400">${label}</span>
      </label>`;
      }
      if (type === 'select' && f.type === 'enum' && f.enumValues) {
        const opts = f.enumValues.map((v) => `          <option value=${JSON.stringify(v)}>${v}</option>`).join('\n');
        return `      <label className="block">
        <span className="block text-sm text-slate-400 mb-1">${label}</span>
        <select
          ${required}
          value={String(draft.${f.name} ?? '')}
          onChange={(e) => setDraft({ ...draft, ${f.name}: e.target.value })}
          className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2"
        >
${opts}
        </select>
      </label>`;
      }
      const inputType = type === 'number' ? 'number' : type === 'date' ? 'date' : 'text';
      const onChange =
        type === 'number'
          ? `(e) => setDraft({ ...draft, ${f.name}: Number(e.target.value) })`
          : `(e) => setDraft({ ...draft, ${f.name}: e.target.value })`;
      return `      <label className="block">
        <span className="block text-sm text-slate-400 mb-1">${label}</span>
        <input
          type="${inputType}"
          ${required}
          value={String(draft.${f.name} ?? '')}
          onChange={${onChange}}
          className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2"
        />
      </label>`;
    })
    .join('\n');

  return `import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ErrorState } from '../components/ErrorState';
import { Loading } from '../components/Loading';
import { ${storeName}Store, type ${entity.name}Draft } from '../lib/entities';

const emptyDraft = (): ${entity.name}Draft => ({
${defaultPairs}
});

export function Edit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<${entity.name}Draft>(emptyDraft);
  const [loading, setLoading] = useState<boolean>(Boolean(id));
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!id) return;
    ${storeName}Store
      .get(id)
      .then((row) => {
        if (row) setDraft({ ...emptyDraft(), ...row });
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} />;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (id) await ${storeName}Store.update(id, draft);
        else await ${storeName}Store.create(draft);
        navigate('/items');
      }}
      className="space-y-4"
    >
      <h2 className="text-xl font-semibold">{id ? 'Edit' : 'New ${entity.name.toLowerCase()}'}</h2>
${fieldJsx}
      <button type="submit" className="rounded-lg bg-white text-slate-900 px-4 py-2 font-medium">
        Save
      </button>
    </form>
  );
}
`;
}

export async function runCreateEdit(workspaceDir: string, spec: Spec): Promise<Partial<SliceArtifacts>> {
  const entity = primaryEntity(spec);
  await writeRel(workspaceDir, 'src/screens/Edit.tsx', renderEditScreen(spec));
  const sha = await commitSlice(workspaceDir, 'create_edit', `add/edit form for ${entity.name}`);
  return {
    commitSha: sha,
    filesWritten: ['src/screens/Edit.tsx'],
    summary: `Create and edit are live. You can add new ${entity.name.toLowerCase()}s and edit existing ones.`,
    whatYouCanDo: [
      `Tap "New" to add a ${entity.name.toLowerCase()}`,
      `Tap "Edit" on a detail page to change a record`,
    ],
    whatRemains: ['Polish + deploy'],
  };
}
