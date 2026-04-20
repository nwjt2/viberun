import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';

export function List() {
  const items: Array<{ id: string; label: string }> = [];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Items</h2>
        <Link to="/items/new" className="rounded-lg bg-white text-slate-900 px-3 py-1.5 text-sm font-medium">
          New
        </Link>
      </div>
      {items.length === 0 ? (
        <EmptyState title="No items yet" blurb="Add your first one to get started." />
      ) : (
        <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
          {items.map((item) => (
            <li key={item.id} className="p-3">
              <Link to={`/items/${item.id}`}>{item.label}</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
