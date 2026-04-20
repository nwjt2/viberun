import { useStore } from '../state/store';

export function SpeakerToggle() {
  const muted = useStore((s) => s.muted);
  const setMuted = useStore((s) => s.setMuted);
  return (
    <button
      className="chip bg-slate-900 border border-slate-800 text-sm"
      onClick={() => setMuted(!muted)}
      aria-pressed={muted}
    >
      {muted ? 'Sound off' : 'Sound on'}
    </button>
  );
}
