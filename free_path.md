rebuild viberun. for now just implement the free-path only, but don't make it difficult to add paid upgrades later.

Important constraints:
1. Viberun is not just for planning/conversations, it is meant to actually enable building a real app (vibe coding while running).
2. Viberun itself should have 0 cost.
3. Default user journey should be free for users, but give users options to upgrade their experience with money, e.g using stronger models, additional tools.
4. The process of building should generally be Viberun giving options and the user choosing by saying 1-3 words and/or tapping very big buttons/swiping. But also always give users an "other" option where users can use free-form speech to describe what they want. 
5. Users should only need to input through their mobile, but the back-end and/or code building can be done elsewhere

Viberun is not a general-purpose builder on the free path. It should narrow user ideas into a buildable first version that fits the free-path technical envelope. Apps should:
I. feel useful to the user (popular apps would be best) but are also
II. simple enough to build while having the cognitive capacity of a person running and can be built using selected infrastructure (including free infrastructure).

Given II., Viberun should work with users to build slices of a full app with the user, rather than trying to build the whole app at once. 

Core User Flow
General interaction rules
* always show only 2 main options at a time where possible
* always include an `Other` option for free-form voice input
* after free-form voice input, always show the transcript in large text with:
  * `Use this`
  * `Re-record`
* every step should be answerable by one tap or 1–3 words
* do not require long reading or long spoken responses
* save progress continuously and restore it cleanly
Before-run onboarding
* ask about the user’s background
* ask what kinds of apps they want to build
* ask enough to guide better idea suggestions later
* do not make onboarding long or heavy
First-run flow
1. Show 2 app ideas.
2. Let the user:
   * pick one
   * ask for 2 more ideas
   * choose `Other` and describe what they want by voice
3. If the user gives a custom idea by voice:
   * confirm the transcript
   * normalize the idea
   * narrow it into a buildable first version if needed
4. Ask follow-up questions to gather enough detail for a high-level spec.
5. Once enough detail is gathered, generate a high-level spec and summarize it briefly.
6. Let the user:
   * accept the spec
   * or revise it by voice
7. Repeat until the spec is accepted.
8. Generate a slice plan and summarize it briefly.
9. Let the user:
   * accept the slice plan
   * or revise it by voice
10. Repeat until the slice plan is accepted.
11. Offer 2 valid slices to start with.
12. Also allow manual slice selection, but only from slices whose dependencies are already satisfied.
13. Once a slice is chosen, ask any remaining slice-specific follow-up questions.
14. When enough detail is gathered, build that slice.
15. After the slice is built, summarize:
   * what was built
   * what the user can now do
   * what remains
16. Let the user:
   * accept the slice
   * or give revision feedback by voice
17. Repeat until the slice is accepted.
18. Then ask whether the user wants to:
   * continue building the same app
   * or save progress and start a different app
19. If continuing, offer the next valid slices and repeat the slice flow.
20. If all required slices are complete, generate the integrated app build, summarize it briefly, and let the user accept it or request revisions by voice.
Resume flow
* at the start of a later run, ask whether the user wants to:
  * continue an unfinished app
  * or start a new app
* if continuing an unfinished app, let the user choose whether to:
  * continue the current unfinished slice
  * or choose the next valid slice
* restore the accepted spec, accepted slice plan, completed slices, preview URL, and current project state
Persistence rules
* save progress after every meaningful step
* save draft spec versions, accepted spec versions, slice plans, slice status, and conversation state
* never make the user repeat work that was already accepted unless they choose to revise it

Viberun should give options that are calibrated to what the free infrastructure can actually build (and to ensure user stays within free limits), target output is web-first PWA apps

Architecture

1) Mobile app
* Flutter
* `speech_to_text` for STT
* `flutter_tts` for TTS
* `supabase_flutter` for backend/auth/realtime

2) Backend for Viberun state
* Supabase
* Auth: magic link email login for MVP
* Database: Postgres
* Realtime: Supabase Realtime
* RLS on all user-owned tables

3) Desktop Build Companion
* Node.js + TypeScript
* `@supabase/supabase-js`
* local filesystem workspaces
* local git repo per generated app
* shell execution from Node
* Gemini CLI as the default free model runtime
Important:
* The Desktop Build Companion is where AI orchestration and code generation happen
* Signs in with the same user account as the mobile app
* Watches for queued jobs from the user
* Writes results back to Supabase

4) Generated app stack
All generated apps must use:
* React
* Vite
* TypeScript
* Tailwind CSS
* React Router
* supabase-js
* PWA support
Do not support Next.js, native mobile targets, or arbitrary stacks.

5) Preview deploys
Use:
* Firebase Hosting preview channels
Implement preview deploy from the desktop Build Companion.



Scope of what Viberun is allowed to build on the free path
* can be built as a web-first PWA
* can be implemented with React, Vite, TypeScript, Tailwind, React Router, and Supabase
* can be broken into independent slices
* can produce useful progress after each slice
* mostly relies on CRUD-style interactions
* has a limited number of entities, screens, and user roles
* does not require background workers
* does not require payments
* does not require live trading or financial execution
* does not require complex external APIs
* does not require heavy AI features inside the generated app
* does not require real-time multiplayer collaboration
* does not require app-store packaging
* does not require compliance-heavy workflows

Supported capabilities:
* landing/home screen
* dashboard screen
* list screen
* detail screen
* create/edit form
* search
* filters
* favorites/saved items
* checklist/task flow
* journal/notes flow
* directory/resource listing
* request/intake flow
* simple booking request flow
* simple user-owned records
* simple owner/admin settings
* static content pages
* authentication
* responsive navigation shell
* empty/loading/error states
* seed/sample data
* preview deployment


Idea suggestion engine
Implement idea suggestions as a scoring system.
Each candidate idea gets:
* `usefulness_score`
* `buildability_score`
* `companion_safety_score`
* `free_infra_fit_score`
* `sliceability_score`
Only surface ideas with high total score.

If the user gives a custom idea by voice:
* normalize it
* extract the underlying product goal
* infer the minimum useful first version
* map it to supported capabilities
* score it
* if buildable, continue
* if too ambitious, reduce it to the closest buildable first version
* explain the reduced-scope version clearly and briefly
* if still not possible, offer 2 reduced-scope alternatives

Slice system
Create a reusable slice engine.
Every accepted project must be decomposed into slices with dependencies based on the capabilities required by its scoped first version.

Use this base slice graph:

base slices

1. `foundation`
   * app name
   * colors
   * typography
   * nav shell
   * homepage shell

2. `data_model`
   * entities
   * local typings
   * database bindings
   * sample data

3. `core_screen`
   * main dashboard or landing screen

4. `list_detail`
   * list page
   * detail page

5. `create_edit`
   * add/edit flow

6. `filter_search_favorites`
   * search
   * filters
   * favorites or saved items

7. `owner_admin`
   * owner settings
   * simple content management
   * visibility toggles

8. `polish_publish`
   * empty states
   * loading states
   * mobile responsiveness
   * PWA basics
   * deployment config

Map each accepted project onto these slices based on the capabilities it requires.

Do not let the user choose a slice whose dependencies are not satisfied.

Generated app rules

All generated apps must:
* be usable on mobile browsers
* be real apps, not mockups
* build successfully
* use simple, consistent UI components
* have clear empty states
* have sample data or setup flow
* avoid paid third-party services by default

Default data behavior by common app shape

record-based apps
* use Supabase for simple user-owned records, metadata, and preferences

request/intake apps
* use Supabase for requests, leads, forms, services, and simple status tracking
* request flow only, no payment, no calendar sync

journal/checklist apps
* default to manual entries, notes, checklist items, and saved states
* do not allow import/export for now

directory/resource apps
* use seed content + searchable records in Supabase

dashboard/content apps
* use simple aggregates, seeded content, and user-owned data in Supabase

Desktop Build Companion behavior

The Desktop Build Companion is the execution brain.

Implement it as a local daemon with these responsibilities:

1. authenticate to Supabase
2. subscribe to user jobs
3. claim queued jobs
4. invoke Gemini CLI with task-specific prompts
5. parse structured outputs
6. modify the local project workspace
7. run validation commands
8. deploy preview
9. write result back to Supabase

job types

Implement these job types:

* `generate_idea_options`
* `normalize_custom_idea`
* `ask_next_clarifying_question`
* `draft_high_level_spec`
* `revise_high_level_spec`
* `draft_slice_plan`
* `revise_slice_plan`
* `get_valid_next_slices`
* `ask_slice_specific_question`
* `implement_slice`
* `revise_slice`
* `finalize_app_summary`

Gemini CLI usage

Use Gemini CLI as the default free-path model engine.

Important:
* use task-specific prompts
* require structured JSON for non-code planning outputs
* keep prompts deterministic
* keep outputs small and parseable
* do not let the model freely redesign the whole app during a slice job

Validation pipeline for `implement_slice`

After each slice implementation, the Build Companion must:

1. run install if needed
2. run lint
3. run typecheck
4. run build
5. if possible, run a minimal smoke test
6. generate a short human summary:
   * what changed
   * what the user can now do
   * what remains
7. deploy preview URL
8. save artifacts and summary

If validation fails:
* retry once with the error context
* if still failing, mark job failed with a helpful summary
* do not loop endlessly

Preview deployment

Implement preview deployment from the Build Companion using Firebase Hosting preview channels.
Expected behavior:
* every accepted slice can have an updated preview URL
* the latest preview URL is shown in the mobile app
* user can open the preview from mobile after the run

Build order

Implement in this exact order.

Phase 1: foundations
* repo setup
* shared schemas
* Supabase setup
* Flutter shell app
* login flow
* project list
* paired Build Companion status screen

Phase 2: mobile voice loop
* tap-to-talk
* transcript confirm
* large buttons
* TTS playback
* idea suggestion screen
* follow-up question screen

Phase 3: Build Companion
* local daemon
* Supabase auth
* job subscription
* Gemini CLI integration
* structured planning jobs only

Phase 4: slice planning
* spec drafting and acceptance
* slice plan drafting and acceptance
* valid-next-slice selection

Phase 5: first real starter shape
Implement one complete end-to-end buildable starter shape first:
* record-based tracker/dashboard app

Must support:
* foundation
* data_model
* core_screen
* create_edit
* list_detail
* polish_publish

Phase 6: expand supported capability combinations
Add support for:
* request/intake flows
* simple booking-request flows
* directory/resource flows
* journal/checklist flows

Phase 7: deploy previews
* Firebase Hosting preview deploys
* preview URLs in mobile app

Phase 8: resume flow
* continue unfinished app
* continue unfinished slice
* choose next valid slice

Phase 9: broaden idea coverage within the same technical envelope
Add support for more combinations of supported capabilities without changing the free-path constraints.

Do not build:
* cloud-hosted coding workers
* billing
* subscriptions
* app-store packaging
* payments
* real-time collaboration
* team workspaces
* GitHub sync as required behavior
* calendar sync
* live stock data
* advanced agent swarms
* arbitrary stack generation
* full design system customization

Required docs

Write good docs as you build:

1. `README.md`
   * what Viberun is
   * architecture
   * setup
   * run locally

2. `docs/free_path_architecture.md`
   * explain mobile app
   * explain Build Companion
   * explain Supabase
   * explain Firebase Hosting previews

3. `docs/build_companion_setup.md`
   * how user pairs the Build Companion
   * how they sign into Gemini CLI
   * how they run the daemon

4. `docs/free_path_scope.md`
   * what Viberun can build in the free path
   * what it refuses
   * how ideas are narrowed into buildable first versions