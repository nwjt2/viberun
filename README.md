# VibeRun

Vibe code while you run. Tap the mic, talk to an AI, hear the reply.

VibeRun is a mobile-first web app for brainstorming and noodling on code out loud — on a run, a walk, wherever. Voice in, voice out. The AI runs in your browser (or on a free-tier provider you choose), so nothing routes through our server and using the app costs the hoster nothing.

This is an MVP. It works end-to-end and that's about it. More features land iteratively in the open.

## How it works

- Phone speech recognition turns your voice into text.
- An AI model replies — either **WebLLM** (runs locally in your browser using WebGPU) or **Google Gemini** (free tier).
- The reply streams back to the screen and gets read aloud.
- Conversation lives in memory on the page only. Reload or tap **Clear conversation** to reset.

The server ([server.js](server.js)) is ~20 lines and only serves static files. It never sees your prompts or any credentials.

## AI providers

On first launch, VibeRun opens Settings and asks you to pick one.

### WebLLM (default)

Runs a small language model **entirely in your browser**. No key, no account, no cost. Genuinely free and private — the model stays on your device.

- First use downloads a model (~700 MB for Llama 3.2 1B, up to ~2.5 GB for Phi 3.5 mini). Cached afterwards in IndexedDB.
- Needs **WebGPU**: iOS Safari 18+, recent Android Chrome, desktop Chrome/Edge. Firefox needs WebGPU enabled via a flag.
- Quality is lower than hosted models. Small models are OK for short conversational help but won't one-shot complex code. Upgrade to the 3B models if your phone can handle the RAM.
- First-time load takes a while (download + compile). Do it on wifi before you head out.

### Google Gemini (free tier)

Uses Google's free-tier Gemini API. Free key, generous daily quota (enough for plenty of runs), no billing required unless you exceed the free limits.

1. Get a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Free, no credit card.
2. Paste it into VibeRun → Settings.
3. Pick a model (Gemini 2.5 Flash is a good default).

The key stays in your browser's `localStorage` and is sent directly to `generativelanguage.googleapis.com`. Nothing routes through our server.

## Running it yourself

```bash
npm install
npm start
# open http://localhost:3000
```

That's it. [server.js](server.js) is a tiny Express static server — swap it for any static host.

### On your phone

The mic and WebGPU both need **HTTPS** (or localhost). To test a dev server from your phone, use a tunnel like Tailscale Funnel, `cloudflared`, or `ngrok`.

### Devcontainer (WSL)

This repo was built with an isolated WSL devcontainer setup. If you're on Windows:

1. In WSL (Ubuntu), `git clone` this repo into your WSL home.
2. `code .` to open it in VS Code.
3. Run **Dev Containers: Reopen in Container**.
4. Once up, `npm start`.

`node_modules`, shell history, and AI-CLI auth all live in named Docker volumes — the repo stays clean.

## Browser support

| Browser | Mic | WebLLM | Gemini |
| --- | --- | --- | --- |
| iOS Safari 18+ | ✓ | ✓ (WebGPU) | ✓ |
| Android Chrome | ✓ | ✓ (WebGPU) | ✓ |
| Desktop Chrome/Edge | ✓ | ✓ | ✓ |
| Firefox | ✗ | — | — |

## Privacy / security

- **WebLLM:** everything stays on your device. The browser downloads the model from a CDN, then runs it locally with no further network traffic.
- **Gemini:** your prompts and key go straight from your browser to Google. No third party sees them (including the VibeRun server). Your key lives in `localStorage` on the device you pasted it into — don't paste into instances you don't trust; a hosted page could exfiltrate it. Run your own copy if you're cautious.

## Contributing / roadmap

Roadmap is deliberately empty. Obvious near-term things: stream TTS sentence-by-sentence as replies arrive; "repeat that" / "slower" voice commands; save transcripts across reloads; support for Groq / OpenRouter free tiers; a local Ollama option over LAN. PRs and issues welcome.
