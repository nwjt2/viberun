# ADR 0001: PWA-first mobile input

## Status

Accepted, 2026-04-19.

## Context

`free_path.md` names **Flutter** as the mobile stack (with `speech_to_text`,
`flutter_tts`, `supabase_flutter`). The user's hard constraint is
**zero cost** for both hoster and end user.

Flutter iOS distribution to a user's own phone requires a Mac + Xcode + a $99/yr
Apple Developer account. Android APKs are free to sideload but require the user
to install the Android SDK and build locally. Neither fits the zero-cost rule
without asking the end user to be a native-mobile developer.

The current repo's prior MVP was a **voice PWA** using the Web Speech API for
STT/TTS and `SpeechSynthesis` for playback. That already worked on the user's
phone.

## Decision

Build the mobile input as a **PWA** on the same stack the spec already
mandates for generated apps (React, Vite, TS, Tailwind, React Router,
supabase-js, PWA). Port the working voice-loop code from the old `public/`
into `apps/mobile-pwa/src/lib/voice/`.

## Consequences

**Positive**

- Zero install-cost for the end user on iOS and Android. Browser →
  Add to Home Screen.
- Matches the generated-app stack, so components like `NavShell`,
  `EmptyState`, and the overall Tailwind design language are shared.
- Fully developable and build-verifiable inside the devcontainer.
- Port of existing working code rather than a Flutter bring-up.

**Negative**

- **Background / screen-off listening is not reliable** in a PWA. Flutter can
  keep the mic active with the screen off; the Web Speech API cannot. For a
  "vibe coding while running" use case this is a real regression — the user
  will tap-to-talk with the screen on.
- Web Speech API differs across browsers. iOS Safari uses `webkitSpeechRecognition`,
  has no continuous mode, and has permission quirks. We inherit these and
  accept them.
- A PWA on iOS 16.4+ supports installable home-screen web apps and push
  notifications, but we still cannot access system-level features Flutter could.

## Alternatives considered

- **Flutter as spec'd.** Rejected because:
  - No Flutter SDK in this devcontainer, and the user's instructions forbid
    touching their personal machine.
  - iOS distribution cost breaks the zero-cost rule.
  - No way to verify Flutter builds in CI without adding a Mac runner.

- **Dual mobile apps (PWA + Flutter later).** Acceptable — nothing in the
  schema or job contracts is PWA-specific. A future `apps/mobile-flutter`
  targeting the same Supabase project is an iteration-N addition, not a
  blocker.

## Follow-ups

- If background listening becomes critical, revisit: a thin Flutter shell that
  hosts the PWA in a WebView can get the best of both (native mic persistence,
  shared UI code). Track as iteration-N+.
- Document the cross-browser Web Speech API quirks we hit in
  `docs/free_path_architecture.md` so a Flutter port has a clear motivation
  list.
