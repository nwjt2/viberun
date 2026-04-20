import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { BaseSliceId, SliceArtifacts } from '@viberun/shared';
import { useStore } from '../state/store';
import { enqueueJob, waitForJob } from '../lib/jobs';

export function SliceBuild() {
  const { baseSlice } = useParams<{ baseSlice: BaseSliceId }>();
  const navigate = useNavigate();
  const acceptedSpec = useStore((s) => s.acceptedSpec);
  const acceptedPlan = useStore((s) => s.acceptedSlicePlan);
  const projectId = useStore((s) => s.projectId);
  const sliceAnswersByBase = useStore((s) => s.sliceAnswersByBase);
  const markSliceDone = useStore((s) => s.markSliceDone);
  const [status, setStatus] = useState<'building' | 'done' | 'failed'>('building');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      if (!acceptedSpec || !acceptedPlan || !projectId || !baseSlice) {
        navigate('/plan', { replace: true });
        return;
      }
      try {
        const sliceAnswers = sliceAnswersByBase[baseSlice] ?? [];
        const job = await enqueueJob({
          type: 'implement_slice',
          projectId,
          payload: {
            projectId,
            spec: acceptedSpec,
            plan: acceptedPlan,
            baseSlice,
            sliceAnswers,
          },
        });
        const done = await waitForJob(job.id, { timeoutMs: 10 * 60_000 });
        if (done.status !== 'done') throw new Error(done.error ?? 'build failed');
        const artifacts = done.result as SliceArtifacts;
        const sliceId = acceptedPlan.slices.find((s) => s.baseSlice === baseSlice)?.id ?? `slice-${baseSlice}`;
        markSliceDone(sliceId, artifacts);
        setStatus('done');
        navigate('/slice');
      } catch (err) {
        setStatus('failed');
        setError(err instanceof Error ? err.message : String(err));
      }
    }
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Building: {baseSlice}</h1>
      {status === 'building' && (
        <div className="animate-pulse text-slate-400">This can take a minute…</div>
      )}
      {status === 'failed' && (
        <div className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">
          {error ?? 'unknown error'}
        </div>
      )}
    </section>
  );
}
