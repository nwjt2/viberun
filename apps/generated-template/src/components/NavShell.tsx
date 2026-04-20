import { Link, NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';

export function NavShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/80 backdrop-blur px-4 py-3 flex items-center gap-3">
        <Link to="/" className="text-lg font-semibold">
          {'{{APP_NAME}}'}
        </Link>
        <nav className="ml-auto flex gap-4 text-sm">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'text-white' : 'text-slate-400')}>
            Home
          </NavLink>
          <NavLink
            to="/items"
            className={({ isActive }) => (isActive ? 'text-white' : 'text-slate-400')}
          >
            Items
          </NavLink>
        </nav>
      </header>
      <main className="flex-1 px-4 py-6 max-w-2xl w-full mx-auto">{children}</main>
    </div>
  );
}
