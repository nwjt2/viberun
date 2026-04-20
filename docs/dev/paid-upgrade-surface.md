# Paid-upgrade surface

Explicit inventory of the seams where Viberun will plug in paid upgrades
later. Iteration 1 does not ship any paid features, but these places are
designed to accept them without a refactor.

## 1. `ModelProvider` interface

**Where:** `packages/companion/src/model/provider.ts`

The big one. Every handler calls `ctx.provider.plan({ ..., schema })` and
receives a parsed, validated result. Adding a new provider is one file in
`packages/companion/src/model/providers/` + one case in
`packages/companion/src/model/index.ts`.

Planned providers:
- `claude` — higher-quality planning for spec / slice-plan jobs.
- `openai` — parity fallback.
- `ollama` — local, private, runs on user's laptop.
- `metered` — wraps another provider, emits per-request cost events to a
  future `UsageMeter` sink.

Swap via config:
```json
{ "provider": { "kind": "claude", "model": "claude-opus-4-7", "apiKey": "sk-..." } }
```

## 2. `Capability` set

**Where:** `packages/shared/src/capabilities.ts`

Adding a capability is a single line in the `CAPABILITIES` tuple, a mapping
entry in the slice graph if it needs new slices, and a weight change in the
scorer if it changes idea selection. No migration. No schema change.

## 3. `IdeaScores.freeInfraFit` threshold

**Where:** `packages/shared/src/scoring.ts` → `IDEA_SURFACE_THRESHOLD`.

Paid tiers can lower the threshold so the scorer surfaces ideas we'd refuse
on the free path (external APIs, higher model-token budgets). Threshold is a
constant today; make it a function of project tier when paid ships.

## 4. `projects.status` enum

**Where:** `supabase/migrations/20260419_010_projects.sql`.

The column is `text not null default 'active'`, so accepting `'paid'` or
`'trial'` is additive and non-breaking. A future `projects.tier uuid
references tiers(id)` column is a clean migration when billing arrives.

## 5. Deploy provider abstraction (iteration 3)

**Where:** `packages/companion/src/deploy/firebase.ts` (stub today).

Iteration 3 will extract an interface:
```ts
interface DeployProvider { deployPreview(workspace, project): Promise<{ url: string }>; }
```

And two implementations: `FirebaseHostingProvider` (default, free), plus e.g.
`VercelPreviewProvider` or `CloudflarePagesProvider` for paid tiers that need
different constraints.

## 6. STT / TTS providers

**Where:** `apps/mobile-pwa/src/lib/voice/stt.ts`, `tts.ts`.

Both are interface-shaped. Web Speech API is provider-zero (free, on-device,
but lower accuracy). Paid upgrade is an adapter that streams audio to a cloud
STT (AssemblyAI, Deepgram, Google Cloud STT) for better dictation quality.

The existing `createWebSpeechStt()` and `createWebSpeechTts()` factories are
what any caller uses; swap in `createAssemblyAiStt(opts)` or similar by
changing a single factory call.

## 7. Billing

**Explicitly not built in iteration 1.** The spec says *"Do not build
billing, subscriptions, payments."*

When billing arrives it plugs in as:
- A Supabase edge function to accept webhooks from the payment provider.
- A `profiles.subscription_tier` column (additive migration).
- A gate in the scorer / provider factory that reads the tier.

No scaffolding is left in the iter-1 codebase — premature abstraction is
worse than a clean future migration.

## Seam audit

When adding any new user-facing behavior, ask:

1. Does this belong on the **free path**, or only with paid upgrade?
2. If free, is it reachable from an **existing seam** (provider, capability,
   score)?
3. If paid-only, which seam does it plug into, and is that seam wide enough?

If (3) requires a new seam, add the interface *now* and leave iteration 1's
implementation trivial. Better a one-line trivial impl than a future
refactor.
