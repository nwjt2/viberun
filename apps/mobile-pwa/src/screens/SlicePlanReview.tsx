import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SlicePlan } from '@viberun/shared';
import { useStore } from '../state/store';
import { enqueueJob, waitForJob } from '../lib/jobs';
import { BigButton } from '../components/BigButton';
import { MicButton } from '../components/MicButton';
import { Transcript } from '../components/Transcript';

export function SlicePlanReview() {
  const navigate = useNavigate();
  const slicePlan = useStore((s) => s.slicePlan);
  const setSlicePlan = useStore((s) => s.setSlicePlan);
  const acceptSlicePlan = useStore((s) => s.acceptSlicePlan);
  const acceptedSlicePlan = useStore((s) => s.acceptedSlicePlan);
  const completed = useStore((s) => s.completedSliceIds);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'review' | 'record' | 'transcript'>('review');
  const [transcript, setTranscript] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!slicePlan) navigate('/spec', { replace: true });
  }, [slicePlan, navigate]);

  if (!slicePlan) return null;

  const next = firstAvailable(slicePlan, completed);

  async function reviseWith(text: string) {
    setLoading(true);
    setError(null);
    try {
      const job = await enqueueJob({
        type: 'revise_slice_plan',
        payload: { previousPlan: slicePlan, revisionTranscript: text },
      });
      const done = await waitForJob(job.id);
      if (done.status !== 'done') throw new Error(done.error ?? 'revise plan failed');
      setSlicePlan(done.result as SlicePlan);
      setMode('review');
      setTranscript('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  if (mode === 'record') {
    return (
      <section className="space-y-4">
        <p className="big-text">Tell me what to change.</p>
        <MicButton onTranscript={(t) => { setTranscript(t); setMode('transcript'); }} />
      </section>
    );
  }
  if (mode === 'transcript') {
    return <Transcript text={transcript} onAccept={() => void reviseWith(transcript)} onRecord={() => { setTranscript(''); setMode('record'); }} />;
  }

  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">Build plan</h1>
      <ol className="space-y-2 text-slate-300">
        {slicePlan.slices.map((s, idx) => (
          <li key={s.id} className="flex items-start gap-3">
            <span className="text-slate-500 text-sm w-6 flex-none text-right">{idx + 1}.</span>
            <div>
              <p className="font-medium">{s.title}</p>
              <p className="text-slate-500 text-sm">{s.blurb}</p>
            </div>
          </li>
        ))}
      </ol>
      {loading && <p className="text-slate-400">Working…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!acceptedSlicePlan ? (
        <>
          <BigButton onClick={() => { acceptSlicePlan(); }}>Looks good</BigButton>
          <BigButton tone="ghost" onClick={() => setMode('record')}>Change something</BigButton>
        </>
      ) : next ? (
        <BigButton onClick={() => navigate(`/questions/${next.baseSlice}`)}>
          Build: {next.title}
        </BigButton>
      ) : (
        <p className="text-slate-400">All slices complete.</p>
      )}
    </section>
  );
}

function firstAvailable(plan: SlicePlan, completed: string[]) {
  const done = new Set(completed);
  return plan.slices.find(
    (s) => !done.has(s.id) && s.dependsOn.every((d) => done.has(d)),
  );
}
