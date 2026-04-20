import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function BigButton({
  children,
  tone = 'primary',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'secondary' | 'ghost'; children: ReactNode }) {
  const toneClasses =
    tone === 'primary'
      ? 'bg-white text-slate-900 hover:bg-slate-200'
      : tone === 'secondary'
        ? 'bg-slate-800 text-white hover:bg-slate-700'
        : 'bg-transparent text-slate-300 border border-slate-700';
  return (
    <button
      {...rest}
      className={`min-h-btn-xl w-full rounded-2xl px-6 font-semibold text-xl transition-colors ${toneClasses} ${className}`}
    >
      {children}
    </button>
  );
}
