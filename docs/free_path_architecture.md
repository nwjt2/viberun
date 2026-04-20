# free-path architecture

How the three pieces of Viberun fit together on the free path.

## Overview

```
 ┌───────────────────────────┐        ┌───────────────────────────┐
 │        Mobile PWA         │        │    Desktop Build         │
 │  apps/mobile-pwa          │        │    Companion             │
 │                           │        │  packages/companion      │
 │  - Web Speech API STT/TTS │        │                          │
 │  - Zustand store + IDB    │        │  - Authenticates to SB    │
 │  - Supabase client        │        │  - Claims jobs           │
 │                           │        │  - Runs ModelProvider    │
 └──────────┬────────────────┘        │  - Writes code + git      │
            │                          │  - Runs validation       │
            │ enqueueJob                │  - Deploys preview       │
            ▼                          └──────────┬───────────────┘
 ┌───────────────────────────┐                     │
 │        Supabase           │◀────────claim───────┘
 │  - auth.users             │
 │  - public.projects        │
 │  - public.specs           │
 │  - public.slice_plans     │
 │  - public.slices          │
 │  - public.jobs (queue)    │
 │  - public.companion_*     │
 │                           │
 │  RLS: user_id = auth.uid  │
 └───────────────────────────┘
```

## Pieces

### Mobile PWA (`apps/mobile-pwa`)

- React + Vite + TypeScript + Tailwind + React Router.
- `vite-plugin-pwa` handles service worker + manifest. Installable from
  browser.
- `src/lib/voice/stt.ts`, `src/lib/voice/tts.ts` — thin interfaces over the
  Web Speech API, so a later paid tier can swap in AssemblyAI / cloud TTS
  without changing UI.
- `src/lib/supabase.ts` — returns `null` when env vars are missing, triggering
  `localMode`. In local mode the PWA talks to the Companion directly via
  `/api/companion/*` (Vite proxy to `http://localhost:4000`).
- `src/lib/progress.ts` — localStorage-backed snapshot. Every meaningful step
  saves state so reload / background tab does not lose progress.
- `src/state/store.ts` — Zustand. Single flat store (`onboarding`, `pickedIdea`,
  `draftSpec`, `acceptedSpec`, `slicePlan`, `acceptedSlicePlan`,
  `completedSliceIds`, `lastSliceArtifacts`, `muted`).
- Screens follow the spec's interaction rules: 2 big options + Other
  (free-form voice) on every step, transcript confirm with Use this / Re-record,
  one-tap or 1–3-word answers.

### Supabase (`supabase/`)

Backs three things: auth (magic-link email), realtime state, and the job queue.

- Migrations are append-only. User applies them via `supabase db push` against
  their free-tier project.
- RLS on every user-owned table: `user_id = auth.uid()`. The Companion signs in
  with the same session as the mobile app, so RLS naturally scopes both ends.
- The job queue lives in `public.jobs`. The Companion atomically claims the
  oldest queued job via the `public.claim_next_job(device_id uuid)` RPC, which
  wraps `UPDATE … WHERE id = (SELECT … FOR UPDATE SKIP LOCKED)`. Safe even if
  the user accidentally runs two Companions.

### Companion (`packages/companion`)

- Node 20 CLI. Not published to npm yet — install via `git clone` + `npm link`.
- Two modes:
  - **local:** in-memory queue + local HTTP server on :4000. No Supabase, no
    Gemini CLI needed. Default in dev.
  - **supabase:** authenticate with magic-link device flow, claim jobs from
    Supabase, heartbeat every 15 s, retry-once on transient errors.
- Dispatch: the `Registry` maps `JobType` → `JobHandler<T>`. The `Runner` parses
  the envelope payload against `JobSchemas[type].input`, invokes the handler,
  validates the output against `JobSchemas[type].output`, and writes it back.
- `ModelProvider` interface at `src/model/provider.ts`: the **primary
  paid-upgrade seam**. Three built-in providers today: `mock` (deterministic
  fixtures for dev), `echo` (trivial smoke test), `gemini-cli` (shells out to
  the free Gemini CLI). Adding `claude`, `openai`, or `ollama` is one new file
  in `src/model/providers/`.
- `src/workspaces/project.ts` creates `<workspacesDir>/<projectId>`, copies the
  `generated-template` in, rewrites `{{APP_NAME}}` placeholders, inits git.
- `src/validate/pipeline.ts` runs install → typecheck → build. On failure
  retries once, then fails the job with a helpful summary.
- `src/deploy/firebase.ts` is a stub today (iteration 3).

### Generated template (`apps/generated-template`)

The starter copied into each user project. Same stack as the mobile PWA
(React/Vite/TS/Tailwind/Router/supabase-js/PWA) so slice handlers compose
familiar primitives (`NavShell`, `EmptyState`, `Loading`, `ErrorState`). It
builds standalone in CI so we always know the starting point is healthy.

## Sequence: idea → slice plan

```
PWA                               queue                 Companion
 │  enqueue generate_idea_options   │                        │
 │─────────────────────────────────▶│                        │
 │                                  │◀──── claimNext ────────│
 │                                  │                        │
 │                                  │                        │  provider.plan(..., IdeaOptions)
 │                                  │◀──── complete ─────────│
 │◀────── waitForJob ───────────────│                        │
 │                                  │                        │
 │  user picks one, or asks "other" │                        │
 │  → enqueue normalize_custom_idea │                        │
 │ …                                │                        │
 │  loop: ask_next_clarifying_...   │                        │
 │  → enqueue draft_high_level_spec │                        │
 │  → accept                        │                        │
 │  → enqueue draft_slice_plan      │                        │
 │  (deterministic, no model)       │                        │
```

## Sequence: implement_slice (iteration 1, foundation only)

```
PWA                               queue                 Companion
 │  enqueue implement_slice         │                        │
 │─────────────────────────────────▶│                        │
 │                                  │◀──── claimNext ────────│
 │                                  │                        │  ensureProjectWorkspace
 │                                  │                        │  copy generated-template
 │                                  │                        │  replace {{APP_NAME}} placeholders
 │                                  │                        │  git init + commit
 │                                  │                        │  typecheck + build
 │                                  │◀──── complete ─────────│
 │◀────── waitForJob ───────────────│                        │
 │  show SliceReview summary        │                        │
```

## Paid-upgrade seams

See [dev/paid-upgrade-surface.md](dev/paid-upgrade-surface.md). The big one is
the `ModelProvider` interface — everything else (capability set, deploy
target, STT/TTS adapters) is configuration or an interface already wired.
