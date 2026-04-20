import { useNavigate, useParams } from 'react-router-dom';

export function Edit() {
  const navigate = useNavigate();
  const { id } = useParams();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        navigate('/items');
      }}
      className="space-y-4"
    >
      <h2 className="text-xl font-semibold">{id ? `Edit item ${id}` : 'New item'}</h2>
      <label className="block">
        <span className="block text-sm text-slate-400 mb-1">Label</span>
        <input
          name="label"
          className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2"
          required
        />
      </label>
      <button type="submit" className="rounded-lg bg-white text-slate-900 px-4 py-2 font-medium">
        Save
      </button>
    </form>
  );
}
