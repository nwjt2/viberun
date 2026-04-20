# Free-tier hygiene

How Viberun stays inside the free tiers of the services it depends on, and
what levers exist if you hit a limit.

## At a glance

| Service | Limit we watch | Enforcement |
|---|---|---|
| Gemini CLI (AI Studio) | RPM, daily requests | Client-side token bucket + daily counter in the companion |
| Supabase DB (free) | 500 MB | `viberun-companion prune` deletes old jobs/events |
| Firebase Hosting (Spark) | Preview channels per site | Auto-reap of expired channels on each deploy |
| GitHub Pages | 100 GB/mo bandwidth | Nothing explicit — PWA is tiny (~200 KB) |

Mock + echo providers are not rate-limited (they have no external cost).

## Gemini — rate limits + daily cap

The companion wraps any real model provider with
[`makeRateLimitedProvider`](../../packages/companion/src/model/rate-limit.ts):

- **Token bucket** — refills at `rpm` tokens per minute. Every `plan(...)`
  call first `await bucket.acquire()`. If you've burst, the next call blocks
  until a token mints.
- **Daily counter** — persisted to `<workspacesDir>/../usage.json` as
  `{ date: "YYYY-MM-DD", count: N }`. When `count >= dailyLimit`, the next
  call throws `QuotaError` and the job fails with a clear message.
- **Automatic backoff** — if the provider does return a rate-limit error
  anyway (HTTP 429, `Resource has been exhausted`, `Quota exceeded`), the
  wrapper retries up to 3× with exponential backoff. Honors
  `retry-after` / `retryDelay` hints from the error message when present.

### Defaults

Conservative, aimed at always staying within Google's free tier:

| Provider | RPM | Daily |
|---|---|---|
| `gemini-cli` | 10 | 200 |
| `claude` (future) | 30 | 2000 |
| `openai` (future) | 60 | 2000 |

Google's published free tier is higher than these numbers. Defaults leave
headroom for burst + the occasional retry.

### Overrides

```bash
# env vars (highest priority)
export VIBERUN_RATE_RPM=20
export VIBERUN_RATE_DAILY=500
export VIBERUN_USAGE_PATH=~/.viberun/usage.json

# or ~/.viberun/config.json:
{
  "rateLimit": {
    "rpm": 20,
    "dailyLimit": 500,
    "meterPath": "/home/you/.viberun/usage.json"
  }
}
```

### What the user sees

- **PWA CompanionStatus screen** — shows `today: N / dailyLimit` with a
  color-coded bar (green → amber at 70% → red at 90%). Surfaces a warning at
  >90%.
- **`viberun-companion doctor`** — prints today's request count, cap, and
  remaining budget.
- **`GET /usage`** on the companion — raw JSON for programmatic checks.

## Supabase — table pruning

The `jobs` and `conversation_events` tables grow with every user action. On
the 500 MB free tier that becomes an issue on the order of tens of thousands
of rows. Run:

```bash
viberun-companion prune                      # default: 14 days, keep failures
viberun-companion prune --days 7             # stricter
viberun-companion prune --no-keep-failed     # also sweep failed jobs
```

Mode-guarded: refuses to run in `VIBERUN_MODE=local` (the in-memory queue
has no persistence — restart the companion to reset). In `supabase` mode it
uses the user's session so RLS keeps the delete scoped to their own rows.

A sensible pattern is a weekly cron job on your laptop that runs `prune`
against your Supabase project. Viberun doesn't install that for you; see
`docs/build_companion_setup.md` for an example crontab line.

## Firebase — channel reaper

Each Viberun project becomes a named Firebase preview channel. Channels
expire server-side (default 7 days) but Viberun also walks the list before
each deploy and `hosting:channel:delete`s any past their `expireTime`. The
reaper is non-fatal — if `hosting:channel:list` fails, deploy proceeds.

To clear everything manually:

```bash
firebase hosting:channel:list --project <your-project>
firebase hosting:channel:delete <channel-name> --project <your-project> --force
```

## What's still NOT guarded

Honest inventory:

- **Token-level budgeting** — we count requests, not tokens. Gemini's free
  tier also has a tokens-per-minute ceiling; a huge single request can
  trigger a 429 even with RPM headroom. The backoff retry catches this, but
  we don't proactively shrink prompts.
- **Multi-device coordination** — the daily counter lives per-companion on
  a laptop. Running the companion on two machines doubles the effective cap
  against Google's view of your key. Fine for single-user, worth noting.
- **Embedded model switching** — if you exceed the daily cap, we fail the
  job. A nicer behavior would be auto-switching to `mock` for
  planning-heavy jobs or surfacing "wait vs upgrade" to the user. Future.

## Paid-upgrade seam

`makeRateLimitedProvider` is the single point where quota policy lives. A
paid tier can plug in:

- Higher `rpm` / `dailyLimit` defaults per provider.
- A `UsageMeter` backed by a cloud DB (shared across devices).
- A cost-based (not request-count) budget.
- Per-project rather than per-user caps.

None of that changes handler code — they still call
`ctx.provider.plan(...)`.
