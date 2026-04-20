// Wraps the Web Speech API. Ported + shrunk from the old public/app.js. Works
// on Chrome (Android + desktop) and iOS Safari 18+. Firefox does not implement
// SpeechRecognition; we surface that with `isSupported`.

type Listener = (text: string, isFinal: boolean) => void;

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: unknown) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

export interface SttProvider {
  readonly isSupported: boolean;
  start(onChunk: Listener): Promise<void>;
  stop(): void;
}

export function createWebSpeechStt(): SttProvider {
  const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  if (!Ctor) {
    return {
      isSupported: false,
      async start() {
        throw new Error('SpeechRecognition not supported on this browser');
      },
      stop() {},
    };
  }
  let rec: SpeechRecognitionLike | null = null;
  return {
    isSupported: true,
    async start(onChunk) {
      rec = new Ctor();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = navigator.language || 'en-US';
      rec.onresult = (event: unknown) => {
        const results = (event as { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }).results;
        let interim = '';
        let finalText = '';
        for (let i = 0; i < results.length; i++) {
          const r = results[i]!;
          if (r.isFinal) finalText += r[0].transcript;
          else interim += r[0].transcript;
        }
        if (finalText) onChunk(finalText.trim(), true);
        else if (interim) onChunk(interim.trim(), false);
      };
      rec.onend = () => {
        // single-shot; callers stop and restart explicitly
      };
      rec.onerror = (e) => {
        // eslint-disable-next-line no-console
        console.warn('stt error', e);
      };
      rec.start();
    },
    stop() {
      rec?.stop();
      rec = null;
    },
  };
}
