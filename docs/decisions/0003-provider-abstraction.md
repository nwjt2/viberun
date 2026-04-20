# ADR 0003: ModelProvider abstraction

## Status

Accepted, 2026-04-19.

## Context

The spec names **Gemini CLI** as the default free-path model runtime. But the
user also said *"don't make it difficult to add paid upgrades later"*. Paid
upgrades will include: swapping Gemini for Claude or GPT for better planning
quality, running a local model (Ollama) for privacy, or using a cost-metered
API with usage quotas.

If handler code calls Gemini CLI directly, swapping it later means touching
every handler.

## Decision

A single `ModelProvider` interface at
`packages/companion/src/model/provider.ts`:

```ts
interface ModelProvider {
  readonly name: string;
  readonly supportsStreaming: boolean;
  plan<T>(args: { jobType: string; prompt: string; schema: z.ZodType<T> }): Promise<T>;
}
```

Every handler depends only on this interface. Three built-in implementations:

- `mock` — deterministic fixtures for dev / CI.
- `echo` — trivial smoke test.
- `gemini-cli` — default free-tier production provider.

A config field (`provider.kind`) selects the implementation. Paid upgrades
(`claude`, `openai`, `ollama`) are new files in `providers/` plus a new case
in the factory — never a handler change.

## Consequences

**Positive**

- Adding a new provider is one file + one case. No blast radius.
- Tests use the `mock` provider; they run in-container without needing
  Gemini CLI or credentials.
- A future cost-tracking wrapper (`class MeteredProvider implements
  ModelProvider`) is non-breaking to add.
- The provider self-declares capabilities (`supportsStreaming`,
  future: `supportsLongContext`, `costClass`) so scheduling logic can pick the
  right provider per job type.

**Negative**

- JSON-in / JSON-out constraint: handlers can't stream generation to the user
  mid-job. For iteration 1's planning-only jobs that's fine; `implement_slice`
  may want streaming UX feedback later. Add `ModelProvider.generate()` for that
  if it becomes a pain point.
- Every provider has to translate its vendor-specific API into the same shape.
  For CLIs that cost.

## Paid-upgrade wiring

See [../dev/paid-upgrade-surface.md](../dev/paid-upgrade-surface.md) for the
full inventory.
