# ADR 0002: Monorepo with npm workspaces

## Status

Accepted, 2026-04-19.

## Context

Viberun has four independently-runnable artifacts that share a contract:

- `apps/mobile-pwa` (browser-side React app)
- `apps/generated-template` (starter copied by the companion)
- `packages/shared` (Zod schemas + slice graph)
- `packages/companion` (Node daemon)

All four consume `@viberun/shared` types or at least share coding style. We
need one repo with coherent CI, not four repos.

## Decision

npm workspaces. One root `package.json` declares `"workspaces": ["packages/*", "apps/*"]`.
Each workspace has its own `package.json` with its own deps, scripts, and
builds.

## Consequences

**Positive**

- Devcontainer already has Node 20 + npm. No extra tooling to install (no pnpm,
  no yarn, no turborepo).
- `npm -w <ws>` scopes commands to a workspace. Easy CI.
- Cross-workspace deps use `"*"` — the workspace symlink Just Works.

**Negative**

- No cache-aware task runner (Turbo, Nx). Build ordering is explicit in
  top-level scripts (`npm run build:pwa` = shared → pwa). Fine at this size;
  revisit at >10 workspaces.
- npm workspaces occasionally de-hoist a dep into a workspace's own
  `node_modules`. When it matters (type identity across packages), add the dep
  to the root instead.

## Alternatives considered

- **pnpm workspaces + turborepo.** Faster installs, better task graph. Rejected
  for now — we don't have the scale to justify the onboarding cost, and the
  devcontainer would need an extra `corepack enable` step.
- **Single package, no workspaces.** Rejected — the mobile PWA and Node
  companion have fundamentally different TS targets and bundlers. Mixing would
  be messy.
