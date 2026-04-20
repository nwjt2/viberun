# supabase

SQL migrations and Supabase CLI config for the Viberun backend.

## What lives here

- `config.toml` — project config (no secrets).
- `migrations/*.sql` — append-only schema migrations. Apply in filename order.
- `seed.sql` — optional seed rows; empty in iteration 1.

## Bootstrap (on your laptop, not in the devcontainer)

1. Create a free Supabase project at <https://supabase.com>.
2. Install the Supabase CLI: <https://supabase.com/docs/guides/cli>.
3. From the repo root:
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
4. Get your project's **URL** and **anon key** from the Project Settings → API
   page. Both are safe to share — the anon key is gated by RLS.
5. Provide them to the mobile PWA and Companion:
   ```bash
   # repo .env.local, consumed by Vite at build/dev time:
   echo "VITE_SUPABASE_URL=..." >> apps/mobile-pwa/.env.local
   echo "VITE_SUPABASE_ANON_KEY=..." >> apps/mobile-pwa/.env.local

   # Companion (when you're ready to move off local mode):
   export VIBERUN_MODE=supabase
   export VIBERUN_SUPABASE_URL=...
   export VIBERUN_SUPABASE_ANON_KEY=...
   npm run dev:companion
   ```

You do not need to do any of this for iteration 1 — the PWA and Companion
both support a local-only mode with no Supabase at all. See `docs/dev/local-dev-without-supabase.md`.

## Schema at a glance

- `projects` — one row per user app being built.
- `specs`, `slice_plans` — append-only versioned documents; `accepted = true`
  marks the version the user agreed to.
- `slices` — per-slice build state.
- `jobs` — the queue the Companion claims from. `public.claim_next_job(device_id)`
  RPC wraps `UPDATE … WHERE id = (SELECT … FOR UPDATE SKIP LOCKED)` so the
  claim is atomic.
- `conversation_events` — append-only UX event log that powers resume.
- `companion_devices` — heartbeat; mobile CompanionStatus screen reads `last_seen_at`.

All user-owned tables have RLS with a single policy: `user_id = auth.uid()`.
