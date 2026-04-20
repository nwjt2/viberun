import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../state/store';
import { BigButton } from '../components/BigButton';
import { getProjectStatus, resolvePreviewUrl } from '../lib/jobs';

export function Resume() {
  const navigate = useNavigate();
  const pickedIdea = useStore((s) => s.pickedIdea);
  const acceptedSpec = useStore((s) => s.acceptedSpec);
  const acceptedPlan = useStore((s) => s.acceptedSlicePlan);
  const completed = useStore((s) => s.completedSliceIds);
  const draftSpec = useStore((s) => s.draftSpec);
  const slicePlan = useStore((s) => s.slicePlan);
  const lastArtifacts = useStore((s) => s.lastSliceArtifacts);
  const projectId = useStore((s) => s.projectId);
  const reset = useStore((s) => s.reset);
  const [workspaceMissing, setWorkspaceMissing] = useState(false);

  useEffect(() => {
    if (!projectId || !acceptedPlan) return;
    void getProjectStatus(projectId).then((status) => {
      if (status && !status.exists) setWorkspaceMissing(true);
    });
  }, [projectId, acceptedPlan]);

  if (!pickedIdea) {
    navigate('/idea', { replace: true });
    return null;
  }

  const next = resumeNextStep({
    hasSpec: Boolean(acceptedSpec),
    hasPlan: Boolean(acceptedPlan),
    hasDraftSpec: Boolean(draftSpec),
    hasDraftPlan: Boolean(slicePlan),
    completedCount: completed.length,
    totalSlices: acceptedPlan?.slices.length ?? 0,
  });

  const completedSet = new Set(completed);

  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">Welcome back.</h1>
      <p className="text-slate-400">You were working on:</p>
      <p className="big-text">{pickedIdea.title}</p>

      {workspaceMissing && (
        <div className="rounded-xl border border-amber-900/50 bg-amber-950/30 p-4 space-y-2 text-sm text-amber-100">
          <p className="font-medium">This project's files are gone from your laptop.</p>
          <p>Maybe the workspace was cleared. Start fresh to continue — your local progress here is kept until you do.</p>
        </div>
      )}

      {acceptedPlan && (
        <div className="space-y-1">
          <p className="text-slate-500 text-sm">
            {completed.length} / {acceptedPlan.slices.length} slices built
          </p>
          <ul className="text-sm space-y-0.5">
            {acceptedPlan.slices.map((s) => (
              <li key={s.id} className="flex gap-2">
                <span className={completedSet.has(s.id) ? 'text-emerald-400' : 'text-slate-600'}>
                  {completedSet.has(s.id) ? '✓' : '•'}
                </span>
                <span className={completedSet.has(s.id) ? 'text-slate-300' : 'text-slate-500'}>
                  {s.title}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {lastArtifacts?.previewUrl && (
        <a
          className="chip bg-white text-slate-900 w-full justify-center"
          href={resolvePreviewUrl(lastArtifacts.previewUrl)}
          target="_blank"
          rel="noreferrer"
        >
          Open your app
        </a>
      )}

      <BigButton onClick={() => navigate(next.route)}>{next.label}</BigButton>
      <BigButton
        tone="ghost"
        onClick={() => {
          if (confirm('Throw away your progress and start a new app?')) {
            reset();
            navigate('/idea');
          }
        }}
      >
        Start something else
      </BigButton>
    </section>
  );
}

function resumeNextStep(state: {
  hasSpec: boolean;
  hasPlan: boolean;
  hasDraftSpec: boolean;
  hasDraftPlan: boolean;
  completedCount: number;
  totalSlices: number;
}): { route: string; label: string } {
  if (state.hasPlan) {
    if (state.totalSlices > 0 && state.completedCount >= state.totalSlices) {
      return { route: '/slice', label: 'Review what was built' };
    }
    return { route: '/plan', label: 'Build the next slice' };
  }
  if (state.hasDraftPlan) return { route: '/plan', label: 'Review the build plan' };
  if (state.hasSpec) return { route: '/plan', label: 'Plan the slices' };
  if (state.hasDraftSpec) return { route: '/spec', label: 'Review the spec' };
  return { route: '/followup', label: 'Keep going' };
}
