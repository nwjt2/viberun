import { useParams, Link } from 'react-router-dom';

export function Detail() {
  const { id } = useParams();
  return (
    <div className="space-y-4">
      <Link to="/items" className="text-sm text-slate-400">
        ← Back
      </Link>
      <h2 className="text-xl font-semibold">Item {id}</h2>
      <p className="text-slate-400">No data yet.</p>
    </div>
  );
}
