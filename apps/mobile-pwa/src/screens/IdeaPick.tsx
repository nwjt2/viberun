import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Idea } from '@viberun/shared';
import { useStore } from '../state/store';
import { BigButton } from '../components/BigButton';
import { TwoOptions } from '../components/TwoOptions';
import { MicButton } from '../components/MicButton';
import { Transcript } from '../components/Transcript';
import { enqueueJob, waitForJob } from '../lib/jobs';

export function IdeaPick() {
  const navigate = useNavigate();
  const setIdea = useStore((s) => s.setIdea);
  const onboarding = useStore((s) => s.onboarding);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [customMode, setCustomMode] = useState(false);
  const [transcript, setTranscript] = useState('');

  async function loadIdeas() {
    setLoading(true);
    setError(null);
    try {
      const job = await enqueueJob({
        type: 'generate_idea_options',
        payload: { onboarding, excludeIds: excluded, count: 2 },
      });
      const done = await waitForJob(job.id);
      if (done.status !== 'done') throw new Error(done.error ?? 'idea generation failed');
      const output = done.result as { options: Idea[] };
      setIdeas(output.options);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadIdeas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function acceptCustom(transcriptText: string) {
    setLoading(true);
    setError(null);
    try {
      const job = await enqueueJob({
        type: 'normalize_custom_idea',
        payload: { transcript: transcriptText, onboarding },
      });
      const done = await waitForJob(job.id);
      if (done.status !== 'done') throw new Error(done.error ?? 'normalize failed');
      const idea = done.result as Idea;
      const projectId = crypto.randomUUID();
      setIdea(idea, projectId);
      navigate('/followup');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  if (customMode && !transcript) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Tell me your idea.</h1>
        <MicButton onTranscript={setTranscript} onError={setError} />
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </section>
    );
  }
  if (customMode && transcript) {
    return (
      <Transcript
        text={transcript}
        onAccept={() => void acceptCustom(transcript)}
        onRecord={() => setTranscript('')}
      />
    );
  }

  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">Pick an idea.</h1>
      {loading && <p className="text-slate-400">Thinking…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!loading && ideas.length > 0 && (
        <TwoOptions
          options={ideas.map((idea) => ({ id: idea.id, label: idea.title, sublabel: idea.oneLiner }))}
          onPick={(opt) => {
            const idea = ideas.find((i) => i.id === opt.id)!;
            const projectId = crypto.randomUUID();
            setIdea(idea, projectId);
            navigate('/followup');
          }}
          onOther={() => setCustomMode(true)}
        />
      )}
      {!loading && ideas.length > 0 && (
        <BigButton
          tone="secondary"
          onClick={() => {
            setExcluded([...excluded, ...ideas.map((i) => i.id)]);
            void loadIdeas();
          }}
        >
          Show me 2 more
        </BigButton>
      )}
    </section>
  );
}
