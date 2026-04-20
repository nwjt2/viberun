// SpeechSynthesis wrapper. Port from old public/app.js — sentence-chunking
// kept minimal for iteration 1. Muting lives in the store.

export interface TtsProvider {
  readonly isSupported: boolean;
  speak(text: string): void;
  cancel(): void;
}

export function createWebSpeechTts(): TtsProvider {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
  if (!synth) {
    return {
      isSupported: false,
      speak() {},
      cancel() {},
    };
  }
  return {
    isSupported: true,
    speak(text) {
      if (!text) return;
      synth.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1;
      utter.pitch = 1;
      synth.speak(utter);
    },
    cancel() {
      synth.cancel();
    },
  };
}
