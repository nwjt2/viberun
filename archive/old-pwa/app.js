import { buildProvider, hasWebGPU, WEBLLM_MODELS, GEMINI_MODELS } from './providers.js';

const logEl = document.getElementById('log');
const interimEl = document.getElementById('interim');
const bannerEl = document.getElementById('banner');
const micBtn = document.getElementById('mic');
const micLabel = document.getElementById('mic-label');
const stopBtn = document.getElementById('stop');
const statusEl = document.getElementById('status');
const settingsBtn = document.getElementById('settings-btn');
const settingsDialog = document.getElementById('settings');
const settingsForm = document.getElementById('settings-form');
const providerInputs = settingsForm.elements.provider;
const webllmFields = document.getElementById('webllm-fields');
const geminiFields = document.getElementById('gemini-fields');
const webllmModelSel = document.getElementById('webllm-model');
const geminiModelSel = document.getElementById('gemini-model');
const geminiKeyInput = document.getElementById('gemini-key');
const ttsOnInput = document.getElementById('tts-on');
const webgpuWarning = document.getElementById('webgpu-warning');
const clearChatBtn = document.getElementById('clear-chat');

const STORAGE = {
  provider: 'viberun.provider',
  webllmModel: 'viberun.webllmModel',
  geminiKey: 'viberun.geminiKey',
  geminiModel: 'viberun.geminiModel',
  tts: 'viberun.tts',
};

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const synth = window.speechSynthesis;

const conversation = [];
let recognition = null;
let listening = false;
let currentAssistantEl = null;
let wakeLock = null;
let speechPrimed = false;

const settings = {
  provider: localStorage.getItem(STORAGE.provider) || 'webllm',
  webllmModel: localStorage.getItem(STORAGE.webllmModel) || WEBLLM_MODELS[0].id,
  geminiKey: localStorage.getItem(STORAGE.geminiKey) || '',
  geminiModel: localStorage.getItem(STORAGE.geminiModel) || GEMINI_MODELS[0].id,
  tts: localStorage.getItem(STORAGE.tts) !== 'false',
};

let provider = buildProvider(settings);

populateModelDropdowns();

if (!SR) {
  showError('This browser does not support speech recognition. Use Chrome on Android, or Safari on iOS 14.5+.');
  micBtn.disabled = true;
} else {
  recognition = new SR();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = navigator.language || 'en-US';
  wireRecognition(recognition);
}

renderEmpty();
wireSettings();

const firstRun = !localStorage.getItem(STORAGE.provider);
if (firstRun) openSettings();

micBtn.addEventListener('click', () => {
  if (!recognition) return;
  if (!providerReady()) { openSettings(); return; }
  primeSpeech();
  if (listening) { recognition.stop(); return; }
  cancelSpeech();
  startListening();
});

stopBtn.addEventListener('click', () => {
  cancelSpeech();
  if (listening) recognition.stop();
  setStatus('idle');
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') requestWakeLock();
});

function providerReady() {
  if (settings.provider === 'gemini') return Boolean(settings.geminiKey);
  return hasWebGPU();
}

function wireRecognition(r) {
  let finalTranscript = '';

  r.onstart = () => {
    finalTranscript = '';
    listening = true;
    micBtn.dataset.state = 'listening';
    micLabel.textContent = 'Listening…';
    setStatus('listening');
    interimEl.textContent = '';
    requestWakeLock();
  };

  r.onresult = (ev) => {
    let interim = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const res = ev.results[i];
      if (res.isFinal) finalTranscript += res[0].transcript;
      else interim += res[0].transcript;
    }
    interimEl.textContent = (finalTranscript + ' ' + interim).trim();
  };

  r.onerror = (ev) => {
    if (ev.error === 'no-speech' || ev.error === 'aborted') return;
    showError(`Mic error: ${ev.error}`);
    setStatus('error');
  };

  r.onend = () => {
    listening = false;
    micBtn.dataset.state = '';
    micLabel.textContent = 'Tap to talk';
    const text = finalTranscript.trim();
    interimEl.textContent = '';
    if (text) sendMessage(text);
    else setStatus('idle');
  };
}

function startListening() {
  try { recognition.start(); }
  catch (err) { showError(`Could not start mic: ${err.message}`); }
}

async function sendMessage(text) {
  retireStaleChips();
  clearEmpty();
  appendMessage('user', text);
  conversation.push({ role: 'user', content: text });

  setStatus('thinking');
  currentAssistantEl = appendMessage('assistant', '');
  currentAssistantEl.classList.add('streaming');

  let full = '';
  try {
    full = await provider.chat(
      conversation,
      (delta) => {
        full += delta;
        currentAssistantEl.textContent = stripChoices(full);
        scrollToBottom();
      },
      (report) => showWebllmProgress(report),
    );
    clearBanner();
  } catch (err) {
    currentAssistantEl.remove();
    currentAssistantEl = null;
    showError(err.message || 'Request failed');
    setStatus('error');
    conversation.pop();
    return;
  }

  const { spoken, choices } = parseReply(full);
  currentAssistantEl.textContent = spoken;
  currentAssistantEl.classList.remove('streaming');
  if (choices.length) attachChips(currentAssistantEl, choices);
  currentAssistantEl = null;
  conversation.push({ role: 'assistant', content: full });

  if (spoken.trim() && settings.tts) speak(spoken);
  else setStatus('idle');
}

const CHOICES_MARKER = '::choices::';

function parseReply(full) {
  const idx = full.indexOf(CHOICES_MARKER);
  if (idx === -1) return { spoken: full.trim(), choices: [] };
  const spoken = full.slice(0, idx).trim();
  const after = full.slice(idx + CHOICES_MARKER.length);
  const firstLine = (after.split('\n')[0] || '').trim();
  const choices = firstLine
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);
  return { spoken, choices };
}

function stripChoices(full) {
  const idx = full.indexOf('::choices::');
  if (idx === -1) return full;
  return full.slice(0, idx).trimEnd();
}

function attachChips(afterEl, choices) {
  const wrap = document.createElement('div');
  wrap.className = 'chips';
  for (const c of choices) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = c;
    b.addEventListener('click', () => onChipTap(c, wrap));
    wrap.appendChild(b);
  }
  afterEl.insertAdjacentElement('afterend', wrap);
  scrollToBottom();
}

function onChipTap(text, wrap) {
  wrap.classList.add('used');
  for (const b of wrap.querySelectorAll('button')) b.disabled = true;
  primeSpeech();
  cancelSpeech();
  sendMessage(text);
}

function retireStaleChips() {
  for (const wrap of logEl.querySelectorAll('.chips:not(.used)')) {
    wrap.classList.add('used');
    for (const b of wrap.querySelectorAll('button')) b.disabled = true;
  }
}

function speak(text) {
  if (!synth) { setStatus('idle'); return; }
  cancelSpeech();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.05;
  u.pitch = 1;
  u.lang = navigator.language || 'en-US';
  let started = false;
  u.onstart = () => { started = true; setStatus('speaking'); };
  u.onend = () => setStatus('idle');
  u.onerror = () => setStatus('idle');
  synth.speak(u);
  setTimeout(() => {
    if (!started && !synth.speaking && !synth.pending) {
      setStatus('idle');
      showError('No audio — check your phone’s silent switch, volume, and that Safari is allowed to play sound.');
    }
  }, 2500);
}

function cancelSpeech() {
  if (synth && (synth.speaking || synth.pending)) synth.cancel();
}

function primeSpeech() {
  if (!synth || speechPrimed) return;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    synth.speak(u);
    speechPrimed = true;
  } catch { /* ignore */ }
}

function appendMessage(role, text) {
  const el = document.createElement('div');
  el.className = `msg ${role}`;
  el.textContent = text;
  logEl.appendChild(el);
  scrollToBottom();
  return el;
}

function scrollToBottom() { logEl.scrollTop = logEl.scrollHeight; }

function setStatus(state) {
  statusEl.dataset.state = state;
  statusEl.textContent = state;
}

function showError(msg) {
  const el = document.createElement('div');
  el.className = 'msg error';
  el.textContent = msg;
  logEl.appendChild(el);
  scrollToBottom();
}

const STARTER_CHIPS = [
  'Brainstorm a new idea',
  'Help me debug something',
  'Weigh a design choice',
  'Plan a refactor',
];

function renderEmpty() {
  const el = document.createElement('div');
  el.className = 'empty';
  el.id = 'empty';
  const hint = document.createElement('p');
  hint.textContent = 'Tap a chip to start, or hit the mic and talk.';
  el.appendChild(hint);
  const chips = document.createElement('div');
  chips.className = 'chips starter';
  for (const text of STARTER_CHIPS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = text;
    b.addEventListener('click', () => {
      primeSpeech();
      sendMessage(text);
    });
    chips.appendChild(b);
  }
  el.appendChild(chips);
  logEl.appendChild(el);
}

function clearEmpty() { document.getElementById('empty')?.remove(); }

function showBanner(text, { progress, error } = {}) {
  bannerEl.hidden = false;
  bannerEl.dataset.state = error ? 'error' : 'info';
  bannerEl.innerHTML = '';
  const label = document.createElement('span');
  label.textContent = text;
  bannerEl.appendChild(label);
  if (typeof progress === 'number') {
    const bar = document.createElement('div');
    bar.className = 'bar-progress';
    const fill = document.createElement('span');
    fill.style.width = `${Math.max(0, Math.min(1, progress)) * 100}%`;
    bar.appendChild(fill);
    bannerEl.appendChild(bar);
  }
}

function clearBanner() {
  bannerEl.hidden = true;
  bannerEl.innerHTML = '';
}

function showWebllmProgress(report) {
  if (!report) return;
  const progress = typeof report.progress === 'number' ? report.progress : undefined;
  const text = report.text || 'Loading model…';
  showBanner(text, { progress });
  if (progress === 1) setTimeout(clearBanner, 800);
}

function populateModelDropdowns() {
  webllmModelSel.innerHTML = '';
  for (const m of WEBLLM_MODELS) {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.label;
    webllmModelSel.appendChild(opt);
  }
  geminiModelSel.innerHTML = '';
  for (const m of GEMINI_MODELS) {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.label;
    geminiModelSel.appendChild(opt);
  }
}

function syncProviderFields() {
  const selected = getSelectedProvider();
  webllmFields.hidden = selected !== 'webllm';
  geminiFields.hidden = selected !== 'gemini';
  if (selected === 'webllm') webgpuWarning.hidden = hasWebGPU();
}

function getSelectedProvider() {
  for (const r of providerInputs) if (r.checked) return r.value;
  return 'webllm';
}

function wireSettings() {
  settingsBtn.addEventListener('click', openSettings);
  for (const r of providerInputs) r.addEventListener('change', syncProviderFields);

  settingsForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const nextProvider = getSelectedProvider();
    const nextWebllmModel = webllmModelSel.value;
    const nextGeminiModel = geminiModelSel.value;
    const nextGeminiKey = geminiKeyInput.value.trim();

    if (nextProvider === 'gemini' && !nextGeminiKey) {
      showError('Please paste a Gemini API key, or pick WebLLM instead.');
      return;
    }
    if (nextProvider === 'webllm' && !hasWebGPU()) {
      showError('WebGPU is not available here. Pick Gemini.');
      return;
    }

    settings.provider = nextProvider;
    settings.webllmModel = nextWebllmModel;
    settings.geminiModel = nextGeminiModel;
    settings.geminiKey = nextGeminiKey;
    settings.tts = ttsOnInput.checked;

    localStorage.setItem(STORAGE.provider, settings.provider);
    localStorage.setItem(STORAGE.webllmModel, settings.webllmModel);
    localStorage.setItem(STORAGE.geminiModel, settings.geminiModel);
    localStorage.setItem(STORAGE.geminiKey, settings.geminiKey);
    localStorage.setItem(STORAGE.tts, String(settings.tts));

    provider = buildProvider(settings);
    settingsDialog.close();

    if (settings.provider === 'webllm') {
      try {
        await provider.preload((r) => showWebllmProgress(r));
        clearBanner();
      } catch (err) {
        showBanner(`WebLLM load failed: ${err.message}`, { error: true });
      }
    }
  });

  clearChatBtn.addEventListener('click', () => {
    conversation.length = 0;
    logEl.innerHTML = '';
    renderEmpty();
    setStatus('idle');
    settingsDialog.close();
  });
}

function openSettings() {
  for (const r of providerInputs) r.checked = r.value === settings.provider;
  webllmModelSel.value = settings.webllmModel;
  geminiModelSel.value = settings.geminiModel;
  geminiKeyInput.value = settings.geminiKey;
  ttsOnInput.checked = settings.tts;
  syncProviderFields();
  if (typeof settingsDialog.showModal === 'function') settingsDialog.showModal();
  else settingsDialog.setAttribute('open', '');
}

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch { /* unsupported or denied */ }
}
