import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Spec, SlicePlan } from '@viberun/shared';
import { useStore } from '../state/store';
import { enqueueJob, waitForJob } from '../lib/jobs';
import { BigButton } from '../components/BigButton';
import { MicButton } from '../components/MicButton';
import { Transcript } from '../components/Transcript';

export function SpecReview() {
  const navigate = useNavigate();
  const draftSpec = useStore((s) => s.draftSpec);
  const setDraftSpec = useStore((s) => s.setDraftSpec);
  const acceptSpec = useStore((s) => s.acceptSpec);
  const setSlicePlan = useStore((s) => s.setSlicePlan);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'review' | 'record' | 'transcript'>('review');
  const [transcript, setTranscript] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!draftSpec) navigate('/followup', { replace: true });
  }, [draftSpec, navigate]);

  if (!draftSpec) return null;

  async function acceptAndPlan() {
    setLoading(true);
    setError(null);
    try {
      acceptSpec();
      const job = await enqueueJob({
        type: 'draft_slice_plan',
        payload: { spec: draftSpec },
      });
      const done = await waitForJob(job.id);
      if (done.status !== 'done') throw new Error(done.error ?? 'plan failed');
      setSlicePlan(done.result as SlicePlan);
      navigate('/plan');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function reviseWith(text: string) {
    setLoading(true);
    setError(null);
    try {
      const job = await enqueueJob({
        type: 'revise_high_level_spec',
        payload: { previousSpec: draftSpec, revisionTranscript: text },
      });
      const done = await waitForJob(job.id);
      if (done.status !== 'done') throw new Error(done.error ?? 'revise failed');
      setDraftSpec(done.result as Spec);
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
      <h1 className="text-2xl font-semibold">{draftSpec.name}</h1>
      <p className="big-text">{draftSpec.pitch}</p>
      <ul className="text-slate-400 text-sm list-disc pl-5 space-y-1">
        {draftSpec.entities.map((e) => (
          <li key={e.name}>
            {e.name}: {e.fields.map((f) => f.name).join(', ')}
          </li>
        ))}
      </ul>
      {loading && <p className="text-slate-400">Working…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <BigButton onClick={() => void acceptAndPlan()}>Looks good</BigButton>
      <BigButton tone="ghost" onClick={() => setMode('record')}>
        Change something
      </BigButton>
    </section>
  );
}
