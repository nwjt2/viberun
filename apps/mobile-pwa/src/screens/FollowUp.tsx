import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Spec } from '@viberun/shared';
import { useStore } from '../state/store';
import { enqueueJob, waitForJob } from '../lib/jobs';
import { TwoOptions } from '../components/TwoOptions';
import { MicButton } from '../components/MicButton';
import { Transcript } from '../components/Transcript';
import { BigButton } from '../components/BigButton';

interface NextQuestion {
  question: string;
  suggestedAnswers: string[];
  done: boolean;
}

export function FollowUp() {
  const navigate = useNavigate();
  const pickedIdea = useStore((s) => s.pickedIdea);
  const answers = useStore((s) => s.answers);
  const addAnswer = useStore((s) => s.addAnswer);
  const setDraftSpec = useStore((s) => s.setDraftSpec);
  const draftSpec = useStore((s) => s.draftSpec);
  const [next, setNext] = useState<NextQuestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customMode, setCustomMode] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!pickedIdea) {
      navigate('/idea', { replace: true });
      return;
    }
    void askNext(draftSpec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function askNext(currentSpec: Spec | null) {
    setLoading(true);
    setError(null);
    try {
      const job = await enqueueJob({
        type: 'ask_next_clarifying_question',
        payload: { draftSpec: currentSpec ?? {}, answeredQuestions: answers },
      });
      const done = await waitForJob(job.id);
      if (done.status !== 'done') throw new Error(done.error ?? 'follow-up failed');
      const result = done.result as NextQuestion;
      if (result.done) {
        await draftSpec_(currentSpec);
      } else {
        setNext(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function draftSpec_(_currentSpec: Spec | null) {
    const job = await enqueueJob({
      type: 'draft_high_level_spec',
      payload: { idea: pickedIdea, answers },
    });
    const done = await waitForJob(job.id);
    if (done.status !== 'done') throw new Error(done.error ?? 'draft spec failed');
    setDraftSpec(done.result as Spec);
    navigate('/spec');
  }

  async function answer(text: string) {
    if (!next) return;
    addAnswer(next.question, text);
    setCustomMode(false);
    setTranscript('');
    await askNext(draftSpec);
  }

  if (loading) return <p className="text-slate-400">Thinking…</p>;
  if (error) return <p className="text-red-400 text-sm">{error}</p>;
  if (!next) return <p className="text-slate-400">Preparing…</p>;

  if (customMode && !transcript) {
    return (
      <section className="space-y-4">
        <p className="big-text">{next.question}</p>
        <MicButton onTranscript={setTranscript} />
      </section>
    );
  }
  if (customMode && transcript) {
    return (
      <Transcript text={transcript} onAccept={() => void answer(transcript)} onRecord={() => setTranscript('')} />
    );
  }

  // Open-ended question: no suggested answers means there's no sensible
  // two-option shortcut. Skip straight to voice input (plus Skip).
  if (next.suggestedAnswers.length === 0) {
    return (
      <section className="space-y-4">
        <p className="big-text">{next.question}</p>
        <MicButton onTranscript={(t) => { setTranscript(t); setCustomMode(true); }} />
        <BigButton tone="ghost" onClick={() => void askNext(draftSpec)}>
          Skip
        </BigButton>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <p className="big-text">{next.question}</p>
      <TwoOptions
        options={next.suggestedAnswers.map((a, i) => ({ id: `${i}`, label: a }))}
        onPick={(opt) => void answer(opt.label)}
        onOther={() => setCustomMode(true)}
      />
      <BigButton tone="ghost" onClick={() => void askNext(draftSpec)}>
        Skip
      </BigButton>
    </section>
  );
}
