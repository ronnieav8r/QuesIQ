# Handoff

Last updated: 2026-05-26

## Current Focus

QuesIQ Interview now has the first owned practice loop live on `quesiq.com`:
email magic-link plus OAuth sign-in, Session-before-voice launch, direct
OpenAI Realtime voice,
voice artifact persistence, a structured post-session practice review, saved
review revisit, profile persistence, history, score summaries, durable
progression, Admin data visibility, and beta feedback/bug reporting. UI
modernization Phase 1A, 1B, Phase 2A text-first navigation refinement, and
Phase 2B icon polish are complete. The QuesIQ Interview brand logo is now wired
into the app shell, Bubble level thresholds have been imported, and the first
backend-owned quest system is in code.

The latest Bubble-reference comparison identified the next highest-value product
gap as Stories + saved Job Targets, because those make practice more personal
and unlock stronger recommendations. Debrief mode and evolving coaching memory
should follow that foundation. Avoid treating Bubble parity as the goal; carry
forward only features that improve practice, feedback, retention, or beta
learning.

Quira now has only a baseline embedded support launcher in QuesIQ. The desired
future Quira experience is a true AI chat assistant that can hold a
conversation, answer product/how-to questions, help troubleshoot, and collect
feedback or bugs with screen/session context. Do not go deeper down the Quira
path until Phase 2 navigation is completed unless the product direction changes.

## Done Since Last Handoff

- Refined responsive mobile and desktop app layouts.
- Added UI-only onboarding/interview context with required name/role and optional
  company, job description, and resume path.
- Split the interview UI into focused components and extracted practice types and
  seeded data.
- Added client-side session setup snapshot launch and focused session screen.
- Added direct OpenAI Realtime WebRTC voice session slice from the session screen.
- Added server-only API key path via `/api/realtime/session` and `.env.example`.
- Added Que first-turn kickoff after the data channel opens.
- Added browser readiness/live/ended/error states, clean session end handling,
  and a typed client artifact draft for transcript and lifecycle events.
- Chose Drizzle for Postgres schema/migrations and Auth.js for the auth slice.
- Added the first Drizzle Session migration plus `/api/sessions` launch creation
  before the voice screen opens.
- Added Session voice artifact persistence after an ended direct voice attempt:
  transcript turns, lifecycle events, start/end metadata, and direct Realtime
  call id are stored without storing audio.
- Added Auth.js GitHub sign-in scaffolding plus Drizzle auth tables and Session
  ownership enforcement for new Session creation, Realtime exchange, and voice
  artifact save.
- Added Google OAuth as a user-facing sign-in provider while keeping GitHub
  OAuth available.
- Added email magic-link sign-in through Auth.js and Brevo transactional email
  env vars, making email the preferred nontechnical user sign-in path.
- Moved sign-in/sign-up into a dedicated auth-gated screen and removed signed-out
  access to Home, History, Practice, Stories, and Me.
- Allowed Google OAuth to link to existing email magic-link accounts that share
  the same verified email, avoiding `OAuthAccountNotLinked` for users who try
  both paths.
- Added the first evaluation handoff from saved Session transcripts into an
  owned structured review with five score dimensions and a next action.
- Added the first owned session history/review revisit path: Home now loads the
  signed-in user's recent Sessions from Postgres and can reopen completed saved
  reviews after leaving the live session screen.
- Added user-owned profile context persistence: onboarding saves preferred name,
  target role, target company, job description, and resume filename into
  Postgres, and the app reloads it for future setup/session snapshots.
- Added a thin retryable review hardening path: Sessions now track review
  status/error, artifact saves mark transcript-backed reviews pending, review
  creation marks processing/completed/failed, and saved transcript sessions can
  be reopened from Home to retry missing or failed reviews.
- Added the first full History view and score summary pass: the app now has a
  History tab with owned sessions, status labels, per-session review averages,
  and Home shows five score averages from completed saved evaluations.
- Added first derived progression on Home: completed reviews create simple XP,
  level progress, last-practiced text, latest next move, and Recommended Next
  reacts to pending reviews or the weakest score dimension.
- Hid created-only/incomplete Sessions from the visible History list so rows
  without transcript or review do not invite users into dead-end session detail.
- Added the first resume-aware context slice: signed-in onboarding can upload a
  resume, the backend saves resume metadata and best-effort parsed text for TXT,
  MD, DOCX, and most PDFs, session snapshots carry that parsed context, and Que
  plus post-session evaluation can use a capped resume excerpt.
- Added seeded backend Interview catalog tables for practice modes, question
  types, and interviewer styles, plus `/api/catalog`. The client now loads those
  records and falls back to the checked-in defaults if the catalog endpoint is
  unavailable.
- Added the first admin prompt config slice: `ADMIN_EMAILS` gates a signed-in
  Admin tab, base prompt configs are versioned in Postgres, admins can view
  versions, save drafts, and activate versions, practice modes/question
  types/interviewer styles have editable prompt instructions, and
  Realtime/Evaluation calls compose those components with user/session context.
- Added the first Admin AI Usage visibility slice: Admin now has Prompts and AI
  Usage sections, Evaluation calls create exact-token API call records, and
  Realtime voice sessions create compact estimated usage records with duration,
  transcript split, model, voice, estimated audio tokens, estimated cost, pricing
  version, and estimation method.
- Added editable Admin AI pricing records and advisory pricing reviews: API and
  Realtime cost calculations now read active pricing rows, admins can edit/add
  pricing under AI Usage > Pricing, and AI pricing reviews compare app pricing
  against `https://developers.openai.com/api/docs/pricing` using
  `PRICING_CHECK_SECRET` for scheduled runs.
- Added monthly AI pricing review support: Admin can trigger a structured
  OpenAI web-search review, and `/api/pricing/review` can be called by the
  Render monthly cron with `PRICING_CHECK_SECRET`. Leave pricing updates manual
  for now; AI acceptance/writeback was explored but is not trusted enough for
  cost accounting without a candidate preview or deterministic parser. As of
  the latest QA, Ronnie suspended the monthly Render pricing-check cron because
  it was not working cleanly and redeployed after every build; treat scheduled
  pricing checks as deprecated/paused for now.
- Added Admin AI Usage organization with spreadsheet-style API call and
  Realtime session tables, per-row estimated costs, editable pricing records,
  and a Render cron runner script for monthly advisory pricing reviews. The
  runner is reference material while the scheduled cron remains suspended.
- Added a local global feedback/bug-reporting slice: signed-in users can open a
  Feedback button from any screen, send a 1-5 rating and/or short bug/feedback
  note, and submissions store user, screen, optional session id, browser
  language, viewport, and user agent in Postgres with Admin visibility.
- Added feedback screenshot support for bugs/feedback, a visible rating prompt
  label so users know what the stars mean, and a one-time post-review popup that
  asks users to rate the usefulness of a newly generated practice review.
- Added sortable Admin table headers for Feedback, API Calls, and Realtime
  Sessions, and split Admin Feedback into Feedback and Bugs subtabs.
- Tightened Admin spreadsheet-style tables so headers stay on one line and long
  values truncate by default but can expand inline when clicked.
- Added durable progression: reviewed sessions now create idempotent
  progression events, update a user progression summary with XP, level, streak,
  longest streak, completed reviews, latest next action, and weakest score, and
  Home reads that saved summary with a backfill path for existing evaluations.
- Added Admin > Progression visibility with Users and XP Events subtabs so
  progression summaries and event ledger updates can be checked without direct
  database access.
- Added editable progression level thresholds in Admin > Progression > Levels;
  level math now reads the threshold table instead of hardcoded fixed levels.
- Added Admin > Data visibility for Users, Profiles, Sessions, and Evaluations
  so core hidden tables can be inspected without database access.
- Began UI modernization Phase 1A by adding design tokens for spacing,
  typography, radius, surface colors, shadows, and transitions, then wiring
  base buttons, inputs, app shell, panels/cards, tables, tabs, and feedback
  dialog primitives to those tokens without changing product flow.
- Completed UI modernization Phase 1B core user-screen cleanup: normalized
  user-facing screen rhythm, mobile key/value rows, small-screen header
  stacking, feedback button placement above bottom nav, and removed
  implementation-flavored copy from the live session surface without changing
  product flow.
- Completed UI modernization Phase 2A text-first navigation refinement: the
  primary nav is now Home, Practice, History, and Me; Stories/Admin moved behind
  Me; Admin remains gated by admin access; secondary views keep Me highlighted;
  and the Quira launcher clears the mobile bottom nav across small viewports.
- Completed UI modernization Phase 2B icon polish: added `lucide-react`, wired
  Home, Practice, History, and Me icons into the primary nav, kept labels
  visible on mobile and desktop, and preserved the four-item single-row mobile
  nav.
- Added QuesIQ Interview brand assets from
  `D:\Altitude Pro Media\QuestIQ\Logo\Finished`: full interview logo in the app
  header and icon-only mark as the app icon metadata.
- Imported Bubble progression levels into a migration: 15 titled thresholds from
  Rookie through Master replace the temporary Level 1-10 defaults.
- Added the first quest system from the revised Bubble quest export: 37 seeded
  progression quests, per-user quest completion records, idempotent quest XP
  ledger events, Home quest progress, and Admin quest visibility.
- Added Admin editing for progression quests so admins can create or update
  quest keys, titles, descriptions, check rules, thresholds, display order,
  active state, and XP rewards. Admin levels already support adding/editing
  arbitrary level thresholds.
- Added scoring polish: Home now separates recent score averages for the latest
  10 reviewed sessions from all-time skill averages, and both sections include a
  highlighted calculated Overall score while keeping the five AI-scored
  dimensions unchanged.
- Split Home progression into separate Level/XP and streak chips, with the
  streak shown as its own flame-icon stat instead of being combined with level.
- Added a 120-second minimum for scored reviews. Shorter saved sessions remain
  visible in History as "Too short to score" but do not create evaluations,
  scores, review XP, or score averages.
- Added the first embedded Quira support baseline inside QuesIQ: the global
  feedback launcher is now a small Quira entry point with Help, Feedback, and
  Bug paths, curated product guidance, optional screenshots, and the same
  screen/session/device context capture behind the scenes. This is not the final
  Quira product experience; the intended future version is an AI chat bot that
  calls an AI model and has a real support conversation with the user.
- Started Story Lab Phase 1: the old Stories placeholder is now a voice-first
  Story Lab where users can speak raw notes, type as a fallback, ask Que for a
  follow-up question, and generate/save a reusable STARR-style story outline
  with categories, alternate spins, coach notes, and a practice prompt.
- Started Story Lab Phase 2 library polish: saved stories can be selected into
  a detail panel and edited after generation, with owner-scoped updates through
  `/api/stories/[storyId]`.
- Started Story Lab Phase 3 practice hooks: saved story cards open directly,
  the explicit action is now Edit Story, and saved story details can launch a
  Practice Story voice session with the story outline included in Que's Realtime
  prompt context and the post-session evaluation input.
- Added Story Lab prompt visibility in Admin: follow-up, outline generation,
  Story Practice Realtime guidance, and Story Practice Evaluation guidance are
  now versioned prompt configs under Admin > Prompts > Base.
- Tightened mobile app chrome by removing the header readiness text and
  signed-in account name while keeping the logo and sign-out action.
- Added hideable mobile navigation: Story Lab is a primary nav item, the bottom
  nav can collapse into a small chevron Menu handle, the preference is stored
  locally, and desktop keeps the left navigation rail.
- Started Debrief mode as a written debrief, then pivoted it after review:
  written debrief generation duplicated the saved practice review, so Debrief
  now means a Realtime voice conversation tied to an existing transcript-backed
  session. Admins can view and edit the Session Debrief prompt under Admin >
  Prompts.
- Refined the post-session evaluation direction using the Bubble scoring
  reference: the evaluation prompt now owns the written "debrief-like" review
  sections, including what worked, focus areas, practice plan, follow-up
  questions, and transcript-backed evidence. The longer-term Debrief product
  direction is a voice conversation tied to a completed session, not a second
  written review.
- Replaced the deprecated written Debrief screen with a voice debrief interface:
  History session cards and the expanded written review can launch a Realtime
  voice debrief that uses the original transcript, written review, score
  evidence, review detail, and coaching memory as context without creating a
  new scored practice session.
- Moved Admin out of Me and into the hamburger menu while keeping it visible
  only for admin users.
- Added the first coaching memory slice without a second memory API call:
  post-session evaluation now receives prior coaching memory and returns an
  updated compact memory object, QuesIQ stores one coaching memory row per user,
  Home shows "What Que Is Learning," and future Realtime voice sessions and
  Debriefs receive the saved memory as quiet coaching context. Admin > Prompts
  shows the updated Session Evaluation and Session Debrief prompt versions.
- Added the first richer Up Next logic on Home as a deterministic recommendation
  waterfall: pending reviews, missing context, missing parsed resume, debriefing
  the latest reviewed session, weakest score practice, Story Lab, near-complete
  quests, and default practice now route the primary recommendation action.
- Added editable XP rules under Admin > Progression > XP Rules. Review XP now
  comes from rule awards instead of a hardcoded flat reward, with a smaller
  completion base and larger highest-only duration/score tiers. Resume upload
  and Debrief completion rewards also use the rules table, and XP Events show
  rule metadata for visibility.
- Added an admin-only demo data seed endpoint/button for the Ronnie account:
  Admin > Data can create representative profile, story, session, evaluation,
  debrief, coaching memory, feedback, and progression rows when missing.
- Deployed the evaluation handoff to `quesiq-web` and manually verified it on
  `quesiq.com`.
- Updated `render.yaml` with a free Blueprint path that provisions Postgres,
  wires `DATABASE_URL`, and runs Drizzle migrations before service start.
- Render was connected to Codex through Render MCP for service, deploy, log,
  Postgres, and environment-variable inspection.
- The existing paid Render service `quesiq-web` was repointed from the older
  Quira repo to `ronnieav8r/QuesIQ` for the active rebuild path.
- Render Postgres `quesiq-interview-db` was created and `quesiq-web` was wired
  to run `npm run db:migrate && npm start`.

## Verified

- ESLint passed.
- TypeScript check passed.
- Latest local feedback/progression/UI/Quira baseline and Story Lab Phase 1/2/3
  checks passed: ESLint, TypeScript, and production build.
- Next production build passed.
- Local `npm` is now available on PATH, and latest checks passed with it.
- Render logs on 2026-05-22 showed the QuesIQ persistence deploy build
  succeeded, Drizzle migrations applied successfully, and Next started.
- Live `quesiq.com` QA passed across the owned practice loop and tonight's
  deployed follow-up slices:
  - GitHub sign-in works.
  - Email magic-link sign-in works.
  - Google sign-in works and can link to an existing email-owned account.
  - GitHub OAuth may silently reauthorize after app sign-out because the browser
    remains signed into GitHub; this is normal provider-session behavior.
  - Signed-out users land on the sign-in screen and cannot access the app tabs.
  - Practice launch creates an owned Session before the voice screen opens.
  - The voice screen shows a real Session UUID.
  - Direct Realtime voice starts and ends normally.
  - Voice Artifact moves to Saved.
  - Practice Review moves to Ready and shows five scores, Coach Note, and Next
    Move.
  - Saved reviews can be reopened from Home and History.
  - Saved review detail shows Session Context, Saved Feedback, and expandable
    Transcript.
  - Profile context persists across refresh/sign-out/sign-in and is reused in
    setup/session snapshots.
  - History lists transcript-backed or reviewed sessions and hides created-only
    incomplete sessions.
  - Home shows score averages, simple XP/level progress, last practiced, latest
    next move, and smarter Recommended Next.
  - Retry Review was manually confirmed working.
  - Signed-out launch is blocked by design.
- Manual voice spike test passed:
  - Que speaks first after start.
  - Audio sounded natural enough.
  - Recent Realtime events appeared.
  - Transcript turns appeared for the user and Que.
  - Disconnect stopped the session cleanly.

## Important Current Decisions

- Living rebuild docs live in this Git repo under `docs/rebuild/`.
- Older OneDrive Bubble/rebuild files are reference copies, not a second source
  of truth unless intentionally resynced.
- Direct OpenAI Realtime is the preferred first browser voice path.
- Default prompt configs are seeded with `gpt-realtime`/`marin` for interview
  voice and `gpt-5.4-mini` for evaluation. After migration, the active
  Postgres prompt config is the editable runtime source.
- Practice mode, question-focus, and interviewer-style instructions are
  editable catalog prompt components and are composed into AI calls at runtime.
- VAPI is a fallback path, not the default path, while phone calls are out of
  scope.
- QuesIQ should own durable user context, session snapshots, transcript/artifact
  records, evaluation, history, and progression.
- Quira should remain embedded in QuesIQ for now, not a separate Render service.
  The current implementation is only a baseline launcher/support panel. The
  desired future version is an AI-backed chat bot and product expert that can
  walk users through QuesIQ, answer questions, do minor troubleshooting, and
  collect bugs/feedback with screen, session, screenshot, and device context.
- UI modernization is the active near-term focus. Phase 1A established design
  tokens/base components, Phase 1B cleaned up core user-screen rhythm and copy,
  and Phase 2 should refine navigation before deeper Quira work.
- Practice mode, question type, and interviewer style records are now
  backend-owned seeded catalog data, with checked-in frontend defaults retained
  as a resilience fallback.
- Email magic links are the primary low-friction auth path. Google OAuth is also
  enabled. GitHub remains available for testing/admin use.
- Resume upload now stores resume metadata and parsed text in the Profile
  record. It does not store raw file binaries or use object storage yet.
- Legacy `.doc` parsing is not supported; DOCX, TXT, MD, and most PDFs are the
  first supported parsing path.
- Review creation remains inline after voice artifact save, with retryable
  status/error tracking. There is no background queue yet.

## Next Best Work

1. Deploy/user-confirm QA the latest Admin, feedback, progression, UI Phase 2,
   and Quira baseline changes on `quesiq-web`.
2. Run/user-confirm database migration QA for the imported levels and quests:
   Progression > Levels shows Rookie through Master, Progression > Quests shows
   37 active quest definitions, level/quest edits save from Admin, and Home
   awards quest XP only once per quest.
3. User-confirm QA the Admin tab: Prompts, Modes, Questions, Styles, API Calls,
   Realtime Sessions, Pricing, Feedback/Bugs, Progression, Levels, and Data.
4. Keep monthly/scheduled pricing checks paused; use manual Admin pricing review
   only if needed.
5. Deploy/user-confirm progression QA: existing reviewed sessions backfill XP,
   new completed reviews award XP once, Home shows saved streak/level/latest
   next action, level thresholds load from Admin, and retry/reopen does not
   double-count.
6. QA scoring polish: Recent Scores reflects the latest 10 reviewed sessions,
   Skill Scores remains all-time, Overall is highlighted, and sub-120-second
   sessions appear in History without scoring or XP.
7. Expand prompted micro-feedback beyond the first review-usefulness popup by
   rotating specific questions about voice realism, transcript accuracy, and
   scoring fairness.
8. Continue Story Lab after the first Phase 3 hook: deploy/user-confirm QA the
   Practice Story voice flow and hideable navigation, then consider saving
   story-practice feedback back onto the Story record as durable story coaching
   history.
9. Work the remaining highest-value Bubble reference gaps into upcoming phases:
   saved job targets, debrief mode, evolving coaching memory, richer Up Next
   routing, refined XP rewards, and AI-backed Quira support.
10. Defer or avoid lower-value parity work until the beta needs it: standalone
   anonymous bug-report page, in-app marketing/blog pages, payments, industry
   packs, mascot work, and VAPI parity.
11. Later Quira work: replace the curated Help panel with an AI chat assistant
   that uses a maintained QuesIQ knowledge base and can submit structured bugs,
   feedback, screenshots, and current screen/session context.
12. Continue deploy/user-confirmed QA for changes because localhost preview is
   deprecated in this environment.
13. Keep verifying that `Launch Voice Session` creates a Session id before direct
   voice opens.

## Watch Outs

- A test `OPENAI_API_KEY` is currently stored locally in ignored `.env.local`;
  rotate the key after the spike/test cycle because it was shared in chat.
- The Render Postgres connection URL was pasted during setup; rotate that
  database credential after the wiring test and replace `DATABASE_URL`.
- Owned practice launch now requires Auth.js sign-in by design.
- Localhost preview is deprecated on any port in this Codex environment until
  we intentionally invest time to fix it. Prefer deploy-based or
  user-confirmed QA instead.
- Render currently also has a separate free `quesiq-interview-rebuild` web
  service. Decide whether to keep, suspend, or remove it after `quesiq-web` is
  confirmed as the active rebuild service.
- Git works but still warns that it cannot access
  `C:\Users\weeks\.config\git\ignore`; this can interfere with clean status
  reporting in PowerShell even though previous status/diff commands worked.
- Pricing review AI output was inconsistent across live tests. Treat it as an
  advisory signal only. Do not rely on AI acceptance/writeback for pricing until
  candidate-row preview or deterministic parsing is implemented.
- `tsconfig.tsbuildinfo` is generated TypeScript cache and intentionally ignored.
