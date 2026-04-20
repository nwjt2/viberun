# Viberun

Vibe code while you run. Talk into your phone; a simple voice-driven loop turns
your ideas into a working web app slice by slice.

Viberun narrows an idea into a buildable first version, lets you approve it by
voice or big-button, and then hands it off to a **local Build Companion** on your
laptop that writes the actual code. The default path is zero-cost: free-tier
Supabase, free-tier Gemini CLI, free GitHub Pages hosting, a PWA on your phone.

This is an iteration-1 MVP. Voice-driven idea → spec → slice plan → the
**foundation** slice of a record-based tracker gets written to disk and built.
More slices and shapes land in later iterations. See `free_path.md` for the
full roadmap.

## Three pieces

```
  phone (PWA)            your laptop                    cloud
  -----------            -----------                    -----
  apps/mobile-pwa  <---> packages/companion  <-------> supabase
                         (Node, Gemini CLI)             (auth + job queue)
                            |
                            v
                         your project workspace
                         (~/.viberun/projects/<id>)
                         built from apps/generated-template
```

- **`apps/mobile-pwa`** — React/Vite/TS/Tailwind PWA. Voice in, voice out. Runs
  on iOS Safari 18+ / Android Chrome. Installs from the browser.
- **`packages/companion`** — Node/TS daemon. Authenticates to your Supabase
  project, watches for jobs, shells out to Gemini CLI for planning/coding, writes
  generated code to a local workspace.
- **`supabase/`** — schema + migrations. Backs auth, the job queue, and your
  project state. Free tier is plenty.

Plus:

- **`packages/shared`** — Zod schemas and types shared by mobile + companion.
- **`apps/generated-template`** — React/Vite/TS/Tailwind/Router/supabase-js/PWA
  starter the Companion copies per new project.

## Quickstart

### Use Viberun (on your phone)

When the PWA is deployed (GitHub Pages, a tunnel from your laptop, or your
own host), open the URL on your phone and **Add to Home Screen**. Tap to talk,
pick options, get a slice built. You also need to run the Companion on a
laptop — see below.

### Run the Companion (on your laptop)

```bash
git clone https://github.com/<you>/viberun && cd viberun
npm ci
npm run dev:companion       # mock provider, local HTTP queue — no Supabase required
```

Full setup with Supabase + Gemini CLI is in
[docs/build_companion_setup.md](docs/build_companion_setup.md).

### Develop Viberun

```bash
npm ci
npm run dev:pwa             # http://localhost:5173
npm run dev:companion       # http://localhost:4000 (in another terminal)
```

The PWA proxies `/api/companion/*` to the Companion in dev mode, so enqueueing
jobs Just Works with zero credentials. Run the full verification suite with:

```bash
npm run verify
```

## Architecture

See [docs/free_path_architecture.md](docs/free_path_architecture.md) for the
deep-dive. In short: mobile PWA enqueues jobs into Supabase; the Companion
claims them with `FOR UPDATE SKIP LOCKED`, calls a pluggable `ModelProvider`
for structured planning, writes code to a local workspace, runs
install/typecheck/build, and writes results back.

## Scope

What Viberun builds, what it refuses, and how it narrows an idea to fit the
free path: [docs/free_path_scope.md](docs/free_path_scope.md).

## Known deviations from the original spec

The spec (`free_path.md`) names Flutter as the mobile stack. Iteration 1 is a
PWA instead. Rationale is in
[docs/decisions/0001-pwa-first-mobile-input.md](docs/decisions/0001-pwa-first-mobile-input.md).
Everything else (Supabase, Companion, generated-app stack, Firebase previews
roadmap) matches the spec.

## Iterations

- **Iter 1 (now):** planning flow + one real slice (foundation of a record-tracker).
- **Iter 2:** broader `implement_slice` (data_model, list_detail, create_edit, polish).
- **Iter 3:** Firebase Hosting preview channels.
- **Iter 4:** more app shapes (intake, booking, directory, journal).

## Privacy

- In local mode, nothing leaves your devices. The PWA talks to the Companion
  over localhost; the Companion talks to Gemini CLI on the same laptop.
- In Supabase mode, your job payloads go to your own Supabase project and stay
  there — no third party sees them. Gemini CLI is subject to Google's own free-tier
  privacy terms.

## License

MIT (see `LICENSE` when it exists — iteration 1 is pre-license; add one before
any external contribution).
