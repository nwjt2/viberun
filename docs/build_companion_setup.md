# Companion setup

How to run the Build Companion on your laptop. The Companion is where Viberun
turns your spec and slice plan into actual generated code.

## Prerequisites

- **Node 20+** (check with `node --version`).
- **Git** (to version the generated project workspace).
- **Supabase project** (free tier is fine). Optional for iteration 1 — local
  mode works without it.
- **Gemini CLI** (free tier, free key from AI Studio). Optional for iteration
  1 — the mock provider works without it.

## Install

```bash
git clone https://github.com/<you>/viberun && cd viberun
npm ci
```

(Published npm packaging lands in iteration 2+; for now, run from a cloned
repo.)

## Dev mode — zero credentials

```bash
npm run dev:companion
```

This runs the Companion in `local` mode with the `mock` provider:

- In-memory job queue exposed on `http://localhost:4000`.
- Deterministic fixtures for every planning job type — no Gemini CLI needed.
- Project workspaces written to `.viberun/projects/<id>` in the repo root so
  you can inspect + delete them freely.

Start the PWA in another terminal (`npm run dev:pwa`), open
`http://localhost:5173` in a mobile browser, and click through.

## Supabase mode — real auth, real queue

1. Create a free Supabase project and run the migrations (see
   [supabase/README.md](../supabase/README.md)).

2. Get the project URL and anon key from Project Settings → API.

3. Start the Companion:
   ```bash
   export VIBERUN_MODE=supabase
   export VIBERUN_SUPABASE_URL=https://<ref>.supabase.co
   export VIBERUN_SUPABASE_ANON_KEY=<anon-key>
   npm run dev:companion
   ```

4. The Companion prints a magic-link URL on stdout. Tap it on your phone (same
   browser the PWA is in) to sign in. The refresh token is stored at
   `~/.viberun/config.json` with mode 0600.

Iteration 1 focuses on local mode; Supabase mode is wired but the end-to-end
pairing flow ships in iteration 2.

## Gemini CLI as the model

```bash
npm install -g @google/gemini-cli   # or whichever package provides the CLI you use
gemini auth login                   # free, no credit card
export VIBERUN_PROVIDER=gemini-cli
npm run dev:companion
```

The Companion shells out `gemini --json` with the prompt on stdin and parses
stdout JSON. If your CLI uses different argv, set:

```bash
# ~/.viberun/config.json
{
  "provider": {
    "kind": "gemini-cli",
    "command": "gemini",
    "args": ["--format", "json"]
  }
}
```

## Reaching the companion from your phone

The PWA calls the companion's HTTP API (to enqueue jobs) and opens preview
URLs it emits. Three ways to make the companion reachable from a phone on
the go:

### 1. Cloudflared quick-tunnel (zero setup, best for a single run)

```bash
# install once (homebrew, apt, or https://github.com/cloudflare/cloudflared/releases)
brew install cloudflared    # or apt install cloudflared

# from a second terminal while the companion is running:
cloudflared tunnel --url http://127.0.0.1:4000
# prints a https://<random>.trycloudflare.com URL
# (use 127.0.0.1, not localhost — cloudflared prefers IPv6 when resolving
# `localhost` and some containers bind only IPv4.)
```

Then on your phone, open the deployed PWA → Companion → **Change endpoint**
→ paste the trycloudflare URL. Also set `VIBERUN_PUBLIC_BASE_URL` to the
same URL before starting the companion so preview URLs are absolute:

```bash
VIBERUN_PUBLIC_BASE_URL=https://<random>.trycloudflare.com npm run dev:companion
```

Quick-tunnels expire after a few hours and get a new random URL. For
longer-lived access use a named cloudflared tunnel, tailscale funnel, or
ngrok.

### 2. Tailscale (stable URL, needs account)

If you run Tailscale on both your laptop and phone, use
`tailscale funnel 4000 on` and the PWA's endpoint can be set to your
tailnet URL. Stable, persists across restarts.

### 3. Firebase Hosting previews (public URL for the generated app only)

Opt-in — installs Firebase Hosting as the DeployProvider. The generated app
gets a permanent `*.web.app` URL per Viberun project (as a named preview
channel). The companion itself still needs a tunnel for job enqueue until
Supabase-mode pairing lands.

```bash
npm i -g firebase-tools
firebase login
# create a Firebase project in the console; grab its project id
export VIBERUN_FIREBASE_PROJECT=<project-id>
npm run dev:companion
```

After each slice build, the SliceReview screen's "Open your app" button
opens the Firebase preview URL directly — no tunnel needed for that link.

## Diagnostics

```bash
node packages/companion/dist/index.js doctor
# or from source:
VIBERUN_MODE=local tsx packages/companion/src/index.ts doctor
```

Prints the loaded config, verifies the Gemini CLI is on PATH if configured,
and prints the workspace dir.

## Troubleshooting

- **PWA says companion offline.** Make sure `npm run dev:companion` is
  running and not crashed. The PWA checks `GET /api/companion/healthz` (proxied
  to `http://localhost:4000/healthz`) every few seconds.
- **`gemini: command not found`** from the Companion: install the Gemini CLI
  and put it on PATH, or switch to the mock provider with
  `VIBERUN_PROVIDER=mock`.
- **`implement_slice` failed on validation.** Look at the `error` in the job
  row (Supabase) or the job's `result` (local mode). Usually npm install or
  typecheck inside the per-project workspace — run `npm install` and
  `npm run typecheck` in `.viberun/projects/<id>/` directly to reproduce.
- **Multiple Companions running.** Supported: `claim_next_job` uses
  `FOR UPDATE SKIP LOCKED` so only one claims any given job. You'll see
  duplicate heartbeats in `companion_devices` — safe to ignore.
