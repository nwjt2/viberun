# Local dev without Supabase

Viberun's default dev mode needs **no credentials**. Useful when you're
writing a handler or tweaking the PWA and don't want to touch your Supabase
project.

## What runs where

- `npm run dev:pwa` → Vite on `http://localhost:5173`. PWA detects no
  `VITE_SUPABASE_URL` → `localMode = true` → calls `/api/companion/*` for
  everything.
- `npm run dev:companion` → Node runs the companion with
  `VIBERUN_MODE=local`. In-memory `LocalJobQueue` is exposed via an HTTP
  server on `:4000`. The Vite dev proxy forwards `/api/companion` to it.

Zero Supabase, zero Gemini CLI. The Companion uses the `mock` provider for
planning jobs and does a deterministic foundation-slice build for
`implement_slice`.

## What's stubbed vs real in local mode

| Capability | Local mode | Supabase/production mode |
|---|---|---|
| Auth | fake user `local-user` | magic-link Supabase auth |
| Job queue | in-memory, lost on restart | Supabase `jobs` table |
| Project state | PWA localStorage only | Supabase `projects` / `specs` / `slice_plans` / `slices` |
| Realtime notifications | short polling | Supabase realtime subscriptions |
| Model | `mock` fixtures | `gemini-cli` (or paid provider) |
| Project workspace | `.viberun/projects/` in repo | `~/.viberun/projects/` |
| Preview deploys | no | Firebase Hosting (iteration 3) |

## Fixtures

The `mock` provider's fixtures are inline in
`packages/companion/src/model/providers/mock.ts`. Add a new fixture by adding
a new entry to the `fixtures` array — no external files, no code-gen.

## Smoke test script

```bash
# terminal 1
npm run dev:companion

# terminal 2
npm run dev:pwa
```

Open `http://localhost:5173` in a mobile browser emulator. Click through
onboarding → idea pick → follow-up → spec review → plan review → build
foundation slice. The foundation slice is written to
`.viberun/projects/<id>/` in the repo. Inspect it with `ls -la
.viberun/projects/`.

## Resetting dev state

- PWA progress lives in `localStorage` at key `viberun.progress.v1`. Clear
  via devtools or the PWA's "Start something else" button.
- Companion jobs are in-memory; restart the companion to wipe.
- Generated project workspaces live at `.viberun/projects/<id>/`; `rm -rf
  .viberun/projects/` nukes them all.

## Hitting the local queue directly

The Companion's local HTTP API is plain JSON. You can curl it:

```bash
# enqueue a job
curl -s -X POST http://localhost:4000/jobs \
  -H 'content-type: application/json' \
  -d '{"type":"generate_idea_options","payload":{"onboarding":{"background":"","appInterests":[]},"excludeIds":[],"count":2}}' \
  | jq .

# fetch the result
curl -s http://localhost:4000/jobs/<id> | jq .
```

Useful for debugging a handler without the PWA in the loop.
