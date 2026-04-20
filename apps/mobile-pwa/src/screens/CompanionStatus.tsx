import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  companionAlive,
  getCompanionBaseUrl,
  getUsage,
  setCompanionBaseUrl,
  type UsageStatus,
} from '../lib/jobs';
import { localMode } from '../lib/supabase';

export function CompanionStatus() {
  const [alive, setAlive] = useState<boolean | null>(null);
  const [base, setBase] = useState(getCompanionBaseUrl());
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState(base);
  const [usage, setUsage] = useState<UsageStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      while (!cancelled) {
        const ok = await companionAlive();
        if (!cancelled) setAlive(ok);
        if (ok) {
          const u = await getUsage();
          if (!cancelled) setUsage(u);
        }
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
    void tick();
    return () => {
      cancelled = true;
    };
  }, [base]);

  const usageBar = usage && usage.dailyLimit
    ? Math.min(100, Math.round((usage.today.count / usage.dailyLimit) * 100))
    : null;

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Companion</h1>

      <div className="space-y-1 text-sm">
        <p className="text-slate-400">
          Mode: <span className="text-white">{localMode ? 'local' : 'supabase'}</span>
        </p>
        <p className="text-slate-400">
          Status:{' '}
          <span className={alive ? 'text-emerald-400' : 'text-amber-400'}>
            {alive === null ? 'checking…' : alive ? 'online' : 'offline'}
          </span>
        </p>
        <p className="text-slate-400 break-all">
          Endpoint: <span className="text-slate-300">{base}</span>
        </p>
      </div>

      {usage && usage.dailyLimit != null && (
        <div className="rounded-xl border border-slate-800 p-3 space-y-2">
          <p className="text-sm">
            <span className="text-slate-400">Today ({usage.provider}):</span>{' '}
            <span className="text-slate-200">
              {usage.today.count} / {usage.dailyLimit}
            </span>{' '}
            <span className="text-slate-500">requests</span>
            {usage.rpm ? <span className="text-slate-500"> · {usage.rpm} RPM cap</span> : null}
          </p>
          {usageBar != null && (
            <div className="h-2 bg-slate-800 rounded overflow-hidden">
              <div
                className={`h-full ${usageBar > 90 ? 'bg-red-500' : usageBar > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${usageBar}%` }}
              />
            </div>
          )}
          {usageBar != null && usageBar > 90 && (
            <p className="text-xs text-red-300">
              Close to the free-tier daily cap. You may want to slow down or switch providers.
            </p>
          )}
        </div>
      )}

      {!edit && (
        <button
          onClick={() => {
            setDraft(base === '/api/companion' ? '' : base);
            setEdit(true);
          }}
          className="chip bg-slate-900 border border-slate-800 text-sm"
        >
          Change endpoint
        </button>
      )}

      {edit && (
        <div className="space-y-3">
          <label className="block">
            <span className="block text-sm text-slate-400 mb-1">
              Companion URL (your laptop's tunnel, e.g. https://xyz.trycloudflare.com)
            </span>
            <input
              type="url"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2"
            />
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const normalized = draft.trim().replace(/\/$/, '') || null;
                setCompanionBaseUrl(normalized);
                setBase(getCompanionBaseUrl());
                setEdit(false);
              }}
              className="chip bg-white text-slate-900"
            >
              Save
            </button>
            <button
              onClick={() => {
                setCompanionBaseUrl(null);
                setBase(getCompanionBaseUrl());
                setEdit(false);
              }}
              className="chip bg-slate-900 border border-slate-800"
            >
              Reset to default
            </button>
            <button onClick={() => setEdit(false)} className="chip text-slate-400">
              Cancel
            </button>
          </div>
        </div>
      )}

      {!alive && (
        <div className="rounded-xl border border-amber-900/50 bg-amber-950/30 p-4 space-y-2 text-sm text-amber-100">
          <p className="font-medium">Your companion is not reachable.</p>
          <p>
            On your laptop: in the repo, run <code>npm run dev:companion</code>. To reach it from your
            phone, run a tunnel (<code>cloudflared tunnel --url http://localhost:4000</code>) and
            paste the tunnel URL in <em>Change endpoint</em> above.
          </p>
        </div>
      )}
      <Link to="/" className="chip bg-slate-900 border border-slate-800 inline-flex">
        Back
      </Link>
    </section>
  );
}
