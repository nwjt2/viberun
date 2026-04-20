# ADR 0005: DeployProvider — local default, Firebase opt-in

## Status

Accepted, 2026-04-20.

## Context

The spec (`free_path.md`) names **Firebase Hosting preview channels** as the
deploy target for the free path. Firebase's free Spark tier supports this.
But using it requires the user to:

1. Create a Google / Firebase project.
2. Install `firebase-tools` (`npm i -g firebase-tools`).
3. Run `firebase login` (browser device flow).
4. Configure the companion with the Firebase project id.

That is four steps of setup before the user can see their app on their phone
— and three of them happen on their laptop, outside the vibe-coding-while-
running loop. For a user who just wants to try it, that's a wall.

Meanwhile: the companion already runs an HTTP server on the local machine.
The generated project already has a `dist/` after every slice build. Serving
`dist/` from the companion's own port is a few lines of code, and combined
with any generic HTTP tunnel (cloudflared, tailscale, ngrok) gets a
phone-reachable preview URL in ~30 seconds with no accounts.

## Decision

Introduce a `DeployProvider` interface with two built-in implementations:

1. **`local` (default).** Companion serves `<workspacesDir>/<projectId>/dist`
   at `/preview/<projectId>/` on its own port. No account, no external
   service. Phone reaches it through any tunnel. `VIBERUN_PUBLIC_BASE_URL`
   makes the emitted preview URLs absolute (so they open in the phone's
   browser from anywhere).

2. **`firebase` (opt-in).** Shells out to `firebase hosting:channel:deploy`
   for a preview channel under a user-provided Firebase project. Selected
   via `VIBERUN_FIREBASE_PROJECT`. Returns a `*.web.app` URL the phone can
   hit directly.

After every successful `implement_slice`, the handler calls
`ctx.deploy.deployPreview(...)` and puts the resulting URL in
`SliceArtifacts.previewUrl`. The PWA's SliceReview and Resume screens show
"Open your app".

## Consequences

**Positive**

- Zero-setup default. Run the companion + a tunnel → preview URL works.
- Firebase stays available for users who want a permanent, public, stable URL.
- The interface leaves room for future `vercel`, `cloudflare-pages`, or
  `netlify` providers. The factory in `src/deploy/index.ts` is the only
  addition needed for each.
- Handlers don't care which provider runs — `ctx.deploy.deployPreview` is
  uniform.

**Negative**

- The local provider requires the companion to keep running (tunnel + laptop
  online). A Firebase preview persists even if the laptop is off. Worth it
  for the zero-setup win; documented.
- Cloudflared quick-tunnels expire every few hours — not a problem for a
  single run, but longer-lived use wants a named tunnel or Firebase.
- Local preview URLs are not shareable publicly without a tunnel. For actual
  sharing, the user upgrades to Firebase.

## Follow-ups

- When Supabase-mode pairing lands, a paired companion can advertise its
  public URL to the PWA automatically (via `companion_devices.public_url`),
  eliminating the manual "Change endpoint" step.
- Per-branch previews (a Firebase hosting channel per slice commit) are a
  possible iteration-4 feature, so the user can compare "before revise" vs
  "after revise" outputs.
