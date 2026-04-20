import { Link } from 'react-router-dom';

export function Home() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{'{{APP_NAME}}'}</h1>
      <p className="text-slate-400">{'{{APP_PITCH}}'}</p>
      <Link
        to="/items"
        className="inline-flex items-center rounded-lg bg-white text-slate-900 px-4 py-2 font-medium"
      >
        Open
      </Link>
    </div>
  );
}
