import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SliceArtifacts } from '@viberun/shared';
import { useStore } from '../state/store';
import { BigButton } from '../components/BigButton';
import { MicButton } from '../components/MicButton';
import { Transcript } from '../components/Transcript';
import { enqueueJob, resolvePreviewUrl, waitForJob } from '../lib/jobs';

export function SliceReview() {
  const navigate = useNavigate();
  const artifacts = useStore((s) => s.lastSliceArtifacts);
  const projectId = useStore((s) => s.projectId);
  const completed = useStore((s) => s.completedSliceIds);
  const acceptedPlan = useStore((s) => s.acceptedSlicePlan);
  const markSliceDone = useStore((s) => s.markSliceDone);
  const [mode, setMode] = useState<'review' | 'record' | 'transcript' | 'revising'>('review');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!artifacts) {
    navigate('/plan', { replace: true });
    return null;
  }

  const lastCompletedId = completed[completed.length - 1];
  const lastSlice = acceptedPlan?.slices.find((s) => s.id === lastCompletedId);

  async function reviseWith(text: string) {
    if (!projectId || !lastSlice || !artifacts) return;
    setMode('revising');
    setError(null);
    try {
      const job = await enqueueJob({
        type: 'revise_slice',
        projectId,
        payload: {
          projectId,
          baseSlice: lastSlice.baseSlice,
          previousArtifacts: artifacts,
          revisionTranscript: text,
        },
      });
      const done = await waitForJob(job.id, { timeoutMs: 5 * 60_000 });
      if (done.status !== 'done') throw new Error(done.error ?? 'revise failed');
      markSliceDone(lastSlice.id, done.result as SliceArtifacts);
      setTranscript('');
      setMode('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setMode('review');
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
    return (
      <Transcript
        text={transcript}
        onAccept={() => void reviseWith(transcript)}
        onRecord={() => { setTranscript(''); setMode('record'); }}
      />
    );
  }
  if (mode === 'revising') return <p className="text-slate-400">Updating…</p>;

  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">Built!</h1>
      <p className="big-text">{artifacts.summary}</p>
      <div>
        <p className="text-slate-400 text-sm uppercase tracking-wide">You can now</p>
        <ul className="list-disc pl-5 space-y-1">
          {artifacts.whatYouCanDo.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-slate-400 text-sm uppercase tracking-wide">Remaining</p>
        <ul className="list-disc pl-5 space-y-1 text-slate-400">
          {artifacts.whatRemains.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      </div>
      {artifacts.previewUrl && (
        <a
          className="chip bg-white text-slate-900 w-full justify-center"
          href={resolvePreviewUrl(artifacts.previewUrl)}
          target="_blank"
          rel="noreferrer"
        >
          Open your app
        </a>
      )}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <BigButton onClick={() => navigate('/plan')}>Next slice</BigButton>
      {lastSlice && (
        <BigButton tone="ghost" onClick={() => setMode('record')}>
          Change something about {lastSlice.title}
        </BigButton>
      )}
    </section>
  );
}
