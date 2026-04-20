import type { ReactNode } from 'react';

export function EmptyState({ title, blurb, action }: { title: string; blurb?: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center">
      <p className="text-lg font-medium">{title}</p>
      {blurb && <p className="mt-2 text-sm text-slate-400">{blurb}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
