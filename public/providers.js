const WEBLLM_ESM = 'https://esm.run/@mlc-ai/web-llm@0.2.79';

const SYSTEM_PROMPT = `You are VibeRun, a voice-first coding companion for someone on a run.

Their side comes from phone speech recognition, so expect fragments, missing punctuation, and misheard homophones (e.g. "JSON" heard as "Jason"). Infer intent charitably; if truly ambiguous, pick the most likely reading and confirm in one short phrase.

Your reply gets read aloud by the phone, so:
- Keep it short. 2 to 4 sentences unless they ask for more.
- Describe the idea in plain English first. Do not dictate long code - they cannot read a screen while running.
- No markdown, bullet lists, code fences, or headers. Just speech.
- If they want code, give a tight snippet plus one sentence explaining what it does.
- Stay in their flow. One clear next step, no piled-on caveats.

The user is running and can barely talk. ALWAYS end your reply with a line of quick-pick options they can tap without speaking:

::choices:: option one | option two | option three

Rules for the ::choices:: line:
- 2 to 4 options, each 2 to 6 words, phrased as something the user would say back (e.g. "rewrite it cleaner", "keep it as is", "show me the code").
- The line must be the very last line, exactly one pipe-separated list after the marker. Nothing after it.
- Weave the same options into the prose above (e.g. "so should we keep it, rewrite it, or add tests?") so the TTS reads them naturally.
- If there is truly nothing to decide (rare — you can almost always offer follow-ups like "go deeper", "move on", "summarise"), you may omit the ::choices:: line.`;

export const WEBLLM_MODELS = [
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 1B — lightest (~700 MB)' },
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 3B — better (~2 GB)' },
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Qwen 2.5 1.5B — small (~1 GB)' },
  { id: 'Qwen2.5-3B-Instruct-q4f16_1-MLC', label: 'Qwen 2.5 3B — coding-leaning (~2 GB)' },
  { id: 'Phi-3.5-mini-instruct-q4f16_1-MLC', label: 'Phi 3.5 mini — 3.8B code-oriented (~2.5 GB)' },
];

export const GEMINI_MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash — free tier' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite — fastest free' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash — free tier' },
];

export function hasWebGPU() {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

let webllmModule = null;
let webllmEngine = null;
let webllmCurrentModel = null;

async function loadWebllmModule() {
  if (!webllmModule) webllmModule = await import(WEBLLM_ESM);
  return webllmModule;
}

async function ensureWebllmEngine(modelId, onProgress) {
  if (!hasWebGPU()) {
    throw new Error('Your browser has no WebGPU support. Switch to Gemini in Settings, or use Chrome/Edge/Safari 18+ with WebGPU enabled.');
  }
  const { CreateMLCEngine } = await loadWebllmModule();
  if (webllmEngine && webllmCurrentModel === modelId) return webllmEngine;
  if (webllmEngine) {
    try { await webllmEngine.unload(); } catch { /* ignore */ }
    webllmEngine = null;
    webllmCurrentModel = null;
  }
  webllmEngine = await CreateMLCEngine(modelId, {
    initProgressCallback: (r) => onProgress?.(r),
  });
  webllmCurrentModel = modelId;
  return webllmEngine;
}

async function chatWebllm(settings, messages, onDelta, onProgress) {
  const engine = await ensureWebllmEngine(settings.webllmModel, onProgress);
  const stream = await engine.chat.completions.create({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
    stream: true,
    max_tokens: 512,
    temperature: 0.7,
  });
  let full = '';
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) {
      full += delta;
      onDelta(delta);
    }
  }
  return full;
}

async function chatGemini(settings, messages, onDelta) {
  if (!settings.geminiKey) {
    throw new Error('No Gemini API key set. Open Settings to paste one (free at aistudio.google.com).');
  }
  const model = settings.geminiModel || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(settings.geminiKey)}`;
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const raw = await resp.text();
  let json = null;
  try { json = JSON.parse(raw); } catch { /* ignore */ }

  if (!resp.ok) {
    const msg = json?.error?.message || raw.slice(0, 300) || `HTTP ${resp.status}`;
    throw new Error(`Gemini ${resp.status}: ${msg}`);
  }

  const cand = json?.candidates?.[0];
  const text = cand?.content?.parts?.map((p) => p.text || '').join('') || '';
  const finish = cand?.finishReason;
  const block = json?.promptFeedback?.blockReason;

  if (!text) {
    if (block) throw new Error(`Gemini blocked the request: ${block}. Try a different phrasing.`);
    if (finish && finish !== 'STOP') throw new Error(`Gemini stopped without output (${finish}).`);
    const snippet = raw ? raw.slice(0, 300) : '(empty body)';
    throw new Error(`Gemini returned no text. Response was: ${snippet}`);
  }

  onDelta(text);
  return text;
}

export function buildProvider(settings) {
  if (settings.provider === 'gemini') {
    return {
      name: 'gemini',
      chat: (messages, onDelta) => chatGemini(settings, messages, onDelta),
      preload: async () => {},
    };
  }
  return {
    name: 'webllm',
    chat: (messages, onDelta, onProgress) => chatWebllm(settings, messages, onDelta, onProgress),
    preload: (onProgress) => ensureWebllmEngine(settings.webllmModel, onProgress),
  };
}
