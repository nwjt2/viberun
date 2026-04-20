import { BigButton } from './BigButton';

export function Transcript({
  text,
  onAccept,
  onRecord,
}: {
  text: string;
  onAccept: () => void;
  onRecord: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <p className="big-text">{text}</p>
      </div>
      <BigButton onClick={onAccept}>Use this</BigButton>
      <BigButton tone="ghost" onClick={onRecord}>
        Re-record
      </BigButton>
    </div>
  );
}
