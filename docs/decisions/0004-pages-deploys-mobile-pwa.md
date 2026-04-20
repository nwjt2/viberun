# ADR 0004: GitHub Pages deploys the mobile PWA

## Status

Accepted, 2026-04-19.

## Context

The prior repo deployed the old `public/` voice-chat PWA to GitHub Pages. The
only public-facing artifact in Viberun iteration 1 is the new
`apps/mobile-pwa`. The Companion is installed locally, the generated template
is a source artifact, Supabase is the user's own cloud project.

Web Speech API and service workers both require HTTPS (or localhost). GitHub
Pages provides that for free.

## Decision

`.github/workflows/pages.yml` now builds `apps/mobile-pwa` and uploads
`apps/mobile-pwa/dist/` as the Pages artifact. `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` are wired as GitHub Actions secrets. If unset (iter-1
default), the PWA ships in local mode and the user must still run a local
Companion reachable via tunnel.

The old `public/` directory is removed in the same commit — git history
preserves it (find it via `git log --follow archive/old-pwa/app.js` or
`git show 286a438:public/app.js`).

## Consequences

**Positive**

- Single canonical URL unchanged.
- HTTPS for free; mic + service worker work on iOS Safari.
- Anon key is safe to expose (RLS-gated).

**Negative**

- When `VITE_SUPABASE_URL` is unset, the deployed Pages build runs in local
  mode — users who open the Pages URL without a local Companion hit a helpful
  "Companion offline" screen but can't progress. Adequate for iteration 1;
  wire the secrets once Supabase is provisioned.
