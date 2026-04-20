import { BigButton } from './BigButton';

export interface OptionItem {
  id: string;
  label: string;
  sublabel?: string;
}

export function TwoOptions({
  options,
  onPick,
  onOther,
  otherLabel = 'Other',
}: {
  options: OptionItem[];
  onPick: (option: OptionItem) => void;
  onOther?: () => void;
  otherLabel?: string;
}) {
  return (
    <div className="grid gap-3">
      {options.map((opt) => (
        <BigButton key={opt.id} onClick={() => onPick(opt)}>
          <span className="block">{opt.label}</span>
          {opt.sublabel && <span className="mt-1 block text-sm font-normal text-slate-500">{opt.sublabel}</span>}
        </BigButton>
      ))}
      {onOther && (
        <BigButton tone="ghost" onClick={onOther}>
          {otherLabel}
        </BigButton>
      )}
    </div>
  );
}
