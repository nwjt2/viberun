# ADR 0006: Free-tier guardrails (rate limits + usage meter)

## Status

Accepted, 2026-04-21.

## Context

Viberun's free path depends on vendor free tiers (Gemini, Supabase, Firebase).
Before this change, nothing prevented the companion from exceeding them. A
user on a 10-minute run could burst requests past Google's per-minute quota,
hit a cryptic CLI error, and fail a slice — the opposite of a working vibe-
coding experience.

We needed guardrails that:

1. Gate every model call with a token bucket so we never burst past the
   free-tier RPM.
2. Refuse new calls when a persistent daily counter is exhausted, rather
   than letting the provider emit a cryptic 429.
3. Retry rate-limit errors we can't prevent (e.g. TPM ceiling hit by a big
   prompt) with exponential backoff instead of failing.
4. Surface usage to the user — PWA chip + CLI `doctor` — so they know when
   they're close to the cap.
5. Keep the mechanism provider-agnostic so Claude/OpenAI/Ollama can plug in
   with different defaults.

## Decision

Introduce `makeRateLimitedProvider(inner, config, logger)` in
[`packages/companion/src/model/rate-limit.ts`](../../packages/companion/src/model/rate-limit.ts).
Every metered provider (today: `gemini-cli`) is wrapped in it by the factory
in `makeProvider(...)`. Three primitives:

- `TokenBucket(rpm)` — classic token bucket, refills continuously.
- `UsageMeter(path)` — JSON file with `{ date, count }`; rolls over at UTC
  midnight.
- `QuotaError` — thrown on daily-cap exhaustion; propagates to the job runner
  and returns a helpful message to the PWA.

Rate-limit error detection is string-match based (429 / "quota" /
"rate limit" / "resource exhausted" / "too many requests"). Retry-after
hints are parsed best-effort from error messages. Up to 3 retries per call
with exponential backoff, capped at 60 s.

Defaults per provider (conservative; free-tier publishes more but we want
headroom):

| Provider | RPM | Daily |
|---|---|---|
| gemini-cli | 10 | 200 |
| claude (future) | 30 | 2000 |
| openai (future) | 60 | 2000 |

Overridable via `VIBERUN_RATE_RPM` / `VIBERUN_RATE_DAILY` /
`VIBERUN_USAGE_PATH` env vars or `~/.viberun/config.json`.

Additionally:

- Supabase pruning via `viberun-companion prune` (subcommand) — deletes old
  jobs + conversation events + failed slices to stay under the 500 MB
  free-tier DB cap.
- Firebase channel reaper inside `FirebaseHostingProvider.deployPreview` —
  walks the channel list before each deploy and deletes any past their
  `expireTime`.

## Consequences

**Positive**

- Predictable behavior at the quota edge. User sees "you're at 180/200"
  instead of a cryptic CLI error.
- Auto-backoff means the occasional TPM hiccup doesn't fail a slice.
- Provider-agnostic. Adding a new provider + raising its limits is config
  only.
- `/usage` endpoint + PWA chip gives the user real-time visibility.

**Negative**

- Token-count budgeting would be more accurate than request-count. We
  deferred it to avoid vendor-specific token parsers. If the user hits TPM
  before RPM, the backoff path catches it but costs wall time.
- Usage counter is per-laptop. Running two companions on the same account
  doubles the effective cap against the provider's view. Documented, not
  solved.
- Defaults are conservative; power users may want to raise them. Env vars
  make that a one-line change.

## Paid-upgrade seam

Per ADR 0003's `ModelProvider` seam, a paid tier plugs in:

- A `CloudUsageMeter` backed by Supabase so multi-device / multi-user caps
  converge.
- A `CostBudget` wrapper that estimates dollar cost per call and stops at
  a monthly ceiling.
- Higher default `rpm`/`dailyLimit` per tier.

The factory (`makeProvider`) is where those wrappers attach; no handler
change.
