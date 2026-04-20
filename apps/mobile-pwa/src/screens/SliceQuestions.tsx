import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { BaseSliceId } from '@viberun/shared';
import { useStore } from '../state/store';
import { enqueueJob, waitForJob } from '../lib/jobs';
import { TwoOptions } from '../components/TwoOptions';
import { MicButton } from '../components/MicButton';
import { Transcript } from '../components/Transcript';
import { BigButton } from '../components/BigButton';

interface Question {
  question: string;
  suggestedAnswers: string[];
  done: boolean;
}

export function SliceQuestions() {
  const { baseSlice } = useParams<{ baseSlice: BaseSliceId }>();
  const navigate = useNavigate();
  const acceptedSpec = useStore((s) => s.acceptedSpec);
  const sliceAnswersByBase = useStore((s) => s.sliceAnswersByBase);
  const setSliceAnswer = useStore((s) => s.setSliceAnswer);
  const [next, setNext] = useState<Question | null>(null);
  const [mode, setMode] = useState<'review' | 'record' | 'transcript'>('review');
  const [transcript, setTranscript] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentAnswers = (baseSlice && sliceAnswersByBase[baseSlice]) || [];

  useEffect(() => {
    if (!acceptedSpec || !baseSlice) {
      navigate('/plan', { replace: true });
      return;
    }
    void askNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseSlice]);

  async function askNext() {
    if (!acceptedSpec || !baseSlice) return;
    setLoading(true);
    setError(null);
    try {
      const job = await enqueueJob({
        type: 'ask_slice_specific_question',
        payload: { spec: acceptedSpec, baseSlice, answeredQuestions: currentAnswers },
      });
      const done = await waitForJob(job.id);
      if (done.status !== 'done') throw new Error(done.error ?? 'slice question failed');
      const q = done.result as Question;
      if (q.done) {
        navigate(`/build/${baseSlice}`);
      } else {
        setNext(q);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function answer(text: string) {
    if (!next || !baseSlice) return;
    setSliceAnswer(baseSlice, next.question, text);
    setMode('review');
    setTranscript('');
    setNext(null);
    await askNext();
  }

  if (error) return <p className="text-red-400 text-sm">{error}</p>;
  if (loading && !next) return <p className="text-slate-400">Thinking…</p>;
  if (!next) return <p className="text-slate-400">Preparing…</p>;

  if (mode === 'record') {
    return (
      <section className="space-y-4">
        <p className="big-text">{next.question}</p>
        <MicButton onTranscript={(t) => { setTranscript(t); setMode('transcript'); }} />
      </section>
    );
  }
  if (mode === 'transcript') {
    return (
      <Transcript
        text={transcript}
        onAccept={() => void answer(transcript)}
        onRecord={() => { setTranscript(''); setMode('record'); }}
      />
    );
  }

  return (
    <section className="space-y-5">
      <p className="big-text">{next.question}</p>
      <TwoOptions
        options={(next.suggestedAnswers.length ? next.suggestedAnswers : ['Yes', 'No']).map((a, i) => ({
          id: `${i}`,
          label: a,
        }))}
        onPick={(opt) => void answer(opt.label)}
        onOther={() => setMode('record')}
      />
      <BigButton tone="ghost" onClick={() => void answer('skipped')}>Skip</BigButton>
    </section>
  );
}
