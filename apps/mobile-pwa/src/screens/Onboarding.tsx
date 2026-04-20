import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { BigButton } from '../components/BigButton';
import { TwoOptions } from '../components/TwoOptions';
import { MicButton } from '../components/MicButton';
import { Transcript } from '../components/Transcript';
import { useStore } from '../state/store';

const BACKGROUND_CHOICES = [
  { id: 'eng', label: 'I write code' },
  { id: 'noncode', label: 'I do not write code' },
];
const INTEREST_CHOICES = [
  { id: 'tracker', label: 'Track things I do' },
  { id: 'tool', label: 'Personal tool' },
];

export function Onboarding() {
  const navigate = useNavigate();
  const setOnboarding = useStore((s) => s.setOnboarding);
  const [background, setBackground] = useState<string | null>(null);
  const [interest, setInterest] = useState<string | null>(null);
  const [customMode, setCustomMode] = useState<'background' | 'interest' | null>(null);
  const [transcript, setTranscript] = useState('');

  if (customMode && !transcript) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Tell me in your own words.</h1>
        <MicButton onTranscript={setTranscript} />
      </section>
    );
  }
  if (customMode && transcript) {
    return (
      <section className="space-y-4">
        <Transcript
          text={transcript}
          onAccept={() => {
            if (customMode === 'background') setBackground(transcript);
            if (customMode === 'interest') setInterest(transcript);
            setCustomMode(null);
            setTranscript('');
          }}
          onRecord={() => setTranscript('')}
        />
      </section>
    );
  }

  if (!background) {
    return (
      <section className="space-y-5">
        <h1 className="text-2xl font-semibold">Quick question.</h1>
        <p className="text-slate-400">Do you write code?</p>
        <TwoOptions
          options={BACKGROUND_CHOICES}
          onPick={(opt) => setBackground(opt.id)}
          onOther={() => setCustomMode('background')}
        />
      </section>
    );
  }
  if (!interest) {
    return (
      <section className="space-y-5">
        <h1 className="text-2xl font-semibold">One more.</h1>
        <p className="text-slate-400">What kind of app would you want to build?</p>
        <TwoOptions
          options={INTEREST_CHOICES}
          onPick={(opt) => setInterest(opt.id)}
          onOther={() => setCustomMode('interest')}
        />
      </section>
    );
  }
  return (
    <section className="space-y-4">
      <p className="big-text">Ready.</p>
      <BigButton
        onClick={() => {
          setOnboarding({ background, appInterests: [interest] }, true);
          navigate('/idea');
        }}
      >
        Let's go
      </BigButton>
    </section>
  );
}
