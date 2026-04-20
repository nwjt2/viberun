import { useEffect, useRef, useState } from 'react';
import { createWebSpeechStt } from '../lib/voice/stt';
import { BigButton } from './BigButton';

export function MicButton({
  onTranscript,
  onError,
}: {
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const sttRef = useRef(createWebSpeechStt());

  useEffect(() => {
    return () => sttRef.current.stop();
  }, []);

  const toggle = async () => {
    if (!sttRef.current.isSupported) {
      onError?.('This browser does not support speech recognition. Use Chrome or Safari.');
      return;
    }
    if (listening) {
      sttRef.current.stop();
      setListening(false);
      setInterim('');
      return;
    }
    setListening(true);
    setInterim('');
    try {
      await sttRef.current.start((text, isFinal) => {
        if (isFinal) {
          setListening(false);
          setInterim('');
          onTranscript(text);
        } else {
          setInterim(text);
        }
      });
    } catch (err) {
      setListening(false);
      onError?.(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-2">
      <BigButton onClick={toggle} tone={listening ? 'secondary' : 'primary'}>
        {listening ? 'Stop listening' : 'Tap to talk'}
      </BigButton>
      {interim && <p className="text-slate-400 italic text-lg">{interim}</p>}
    </div>
  );
}
