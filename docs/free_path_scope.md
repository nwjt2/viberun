# free-path scope

What Viberun can build on the free path, what it refuses, and how it narrows
an over-ambitious idea down to something buildable.

## Supported capabilities

From `packages/shared/src/capabilities.ts`. Every supported idea maps to a
subset of these.

- `landing`, `dashboard` — home / summary surfaces.
- `list`, `detail` — browse entities.
- `create_edit` — add / edit forms.
- `search`, `filter`, `favorites` — refinement on lists.
- `checklist`, `journal` — simple tap-to-log entries.
- `directory` — seed-content catalogs with search.
- `intake`, `booking` — form-driven request flows (no payment, no calendar sync).
- `records` — user-owned rows with typed fields.
- `owner_admin` — settings + simple content management.
- `static_content` — about / help pages.
- `auth` — magic-link sign-in via Supabase.
- `nav_shell`, `states` — layout + empty/loading/error states.
- `seed_data` — sample rows shipped with the app.
- `preview_deploy` — Firebase Hosting preview channels (iteration 3).

## The base slice graph

Every accepted project is decomposed into some subset of these 8 base slices,
in dependency order:

1. `foundation` — app name, colors, typography, nav shell, homepage shell.
2. `data_model` — entities, local typings, Supabase bindings, sample data. Depends on `foundation`.
3. `core_screen` — main dashboard or landing. Depends on `foundation`, `data_model`.
4. `list_detail` — list + detail screens. Depends on `data_model`.
5. `create_edit` — add / edit flow. Depends on `data_model`.
6. `filter_search_favorites` — search, filters, saved items. Depends on `list_detail`.
7. `owner_admin` — settings + content management. Depends on `data_model`.
8. `polish_publish` — empty states, loading, responsive, PWA basics, deploy. Depends on `foundation`.

See `packages/shared/src/slice-graph.ts` for the canonical graph.

## What Viberun refuses

- Live market data / financial execution (stocks, crypto).
- Real-time multiplayer collaboration.
- Background workers, cron jobs beyond Supabase edge functions.
- Payments, subscriptions, invoicing.
- App-store packaging.
- Compliance-heavy flows (HIPAA, PCI, banking KYC).
- Advanced AI features inside the generated app (RAG, agents, tools). The
  default app is CRUD-shaped; AI belongs to the builder, not the built.

When you ask for one of these, Viberun narrows:

> *"I can't build live stock trading, but I can build a **watchlist app** that
> records tickers you're interested in with notes. Want that?"*

The refusal message pattern:

1. Say what we can't do (one sentence).
2. Offer the closest buildable first version (one sentence).
3. Let the user accept or ask for a different narrowed option.

The `generate_idea_options` and `normalize_custom_idea` jobs do this scoring
automatically via `packages/shared/src/scoring.ts`:

- `usefulness_score` — will the user actually use it?
- `buildability_score` — can we build it with supported capabilities?
- `companion_safety_score` — is it safe for the Companion to generate (no
  destructive file ops, no network fan-out)?
- `free_infra_fit_score` — does it stay inside free-tier Supabase + Pages?
- `sliceability_score` — can we split it into independently-useful slices?

Ideas below the threshold (`IDEA_SURFACE_THRESHOLD`) are filtered out before
the user ever sees them. If a custom voice idea can't be narrowed above the
threshold, Viberun offers 2 reduced-scope alternatives instead.

## Generated-app invariants

Every app Viberun builds:

- Uses React + Vite + TypeScript + Tailwind + React Router + supabase-js + PWA.
- Has working nav, home, and at least one entity CRUD flow after the
  first few slices.
- Has empty / loading / error states (after `polish_publish`).
- Has seeded sample data or a setup flow so the app is not empty on first open.
- Builds cleanly in CI. The Companion runs `install → typecheck → build` after
  every slice and fails the job if it doesn't.
- Has a clear preview URL after `preview_deploy` (iteration 3).

## Not in scope for any iteration

- Cloud-hosted coding workers (the spec says no; the Companion runs on the
  user's laptop).
- Team workspaces, shared org accounts.
- GitHub sync as required behavior.
- Calendar sync, live external APIs.
- Arbitrary stack generation (no Next.js, no Svelte, no React Native).
- Full design system customization.
