# Handoff

Last updated: 2026-05-30

## Immediate Handoff Snapshot

- Current manager workspace:
  `C:\Users\weeks\Documents\github\QuesIQ-workspace\QuesIQ-manager` on `main`.
  Use the manager/worker clone flow in `docs/rebuild/BRANCHING_AND_RELEASES.md`
  and `docs/platform/PARALLEL_DEVELOPMENT.md`. The older
  `C:\Users\weeks\Documents\github\QuesIQ` checkout is reference/archive.
- Latest integration pass is `64cb042 Merge Study XP quest progression slice`.
  `QuesIQ-manager/main` is clean and aligned with `origin/main` at that commit.
- The current worker-thread set is Manager, Admin, Interview, Study, and DPE.
  Admin owns shared `/admin` and Content Studio work; product workers own their
  product lanes and must not work on or push `main`.
- Admin Content Studio now has the first usable run/review slice:
  `/admin?product=content` can submit Study flashcard source material or DPE
  content source material through `/api/admin/content-studio/runs`, call the
  product-owned draft generators, and save durable review state in
  `content_studio_runs`. Saved runs can be reopened in the Admin review panel,
  and reviewer notes/status changes persist. Publish, Official, and Verified
  state changes remain disabled.
- Study Content Studio draft generation is product-owned at
  `/api/study/content-studio/flashcard-draft`. Draft responses include stable
  draft/fingerprint metadata, card count, confidence summary, warning severity,
  missing fields, and review checklist sections for Admin review.
- DPE Content Studio draft generation is product-owned at
  `/api/dpe/content/draft`. It returns certificate, ACS, oral-question,
  answer-key, rubric, confidence, warning, readiness, and missing-field draft
  JSON without writing to DPE content tables. This endpoint is now wired into
  the Admin Content Studio run/review flow.
- Dedicated durable Content Studio run storage now exists in migration
  `0051_add_content_studio_runs.sql`. Existing `ai_runs` remains AI-call audit
  history and may be linked from a Content Studio run when available. Product
  table publish controls and publish audit events remain future work.
- Latest local work is the QuesIQ marketing homepage regeneration plus recent
  platform/DPE import work. It is locally verified but not yet visually
  user-confirmed in production.
- Root `/` now renders the new marketing homepage in
  `src/features/marketing/marketing-home.tsx`, inspired by the user's two
  generated references: dark navy/purple/orange QuesIQ brand, hero CTA,
  product previews for Interview/Study/DPE, dashboard-style visual, trust
  section, and stats row.
- The old root page export was replaced in `src/app/page.tsx`. Shared platform
  product routing still exists in `src/features/platform/platform-home.tsx`,
  but the public homepage is now marketing-first.
- Site metadata now presents the broader platform, not only Interview:
  `src/app/layout.tsx` title is `QuesIQ | AI Practice Platform`, with dark
  theme color.
- Marketing homepage styling was appended to `src/app/globals.css` under
  `.marketing-*` classes. The CSS includes desktop and mobile responsive
  behavior; the user still needs visual confirmation because local headless
  browser screenshot attempts failed on this machine with Chrome/Edge GPU
  runtime errors.
- Latest local verification for the marketing homepage passed on 2026-05-29:
  `npm run typecheck`, `npm run lint`, and `npm run build`.
- Marketing homepage code is present in the current local Git history as commit
  `6fb6271 Regenerated the homepage marketing`.
- QuesIQ DPE has been imported as a separate product lane under `/dpe` and
  `/api/dpe/*`, using DPE-owned `dpe_*` tables keyed by the shared Auth.js user
  id. Voice is assumed working for now; deeper voice troubleshooting is parked
  for later.
- Important DPE deploy watch-out: migration
  `drizzle/0050_add_dpe_baseline_tables.sql` exists and the Drizzle journal was
  updated so Render should actually apply it on next deploy. The production log
  error `relation "dpe_*" does not exist` meant the table migration had not run,
  not that the app code was using a separate database.
- Shared login/account gateway slice is in place: `/login` accepts `next` and
  product targeting, `/account` is a product hub, and CTAs can route users into
  Interview, Study, or DPE after sign-in.
- Original marketing reference was found in
  `C:\Users\weeks\Documents\github\quira-chat-server`, especially
  `public/index.html` and brand assets. Treat it as reference material only;
  do not import the old Express server as the active platform.
- QuesIQ Study import handoff now lives at
  `docs/products/study/HANDOFF.md`. Use it before continuing the import from
  `C:\Users\weeks\Documents\github\claude_flashcards`; the remaining Study
  work is now mostly migration/seed QA, production permission QA, R2 env
  verification, mobile visual QA, and real public-library content curation.
- Latest broader local work is ready for deploy QA, not yet user-confirmed in
  production.
- User preference for future work: Codex should handle the full edit, verify,
  commit/push, and deploy-prep flow when requested. Do not assume the user will
  manually inspect code or catch implementation mistakes in GitHub; explain
  risks and verification in plain language and make the next action explicit.
- New Study migrations to verify on deploy through
  `0049_seed_study_library_taxonomy.sql`.
- Recent completed local slices:
  - Job Targets now support true edit, delete, persisted active target, and
    target-aware Home nudges.
  - TMAAT saved stories now support delete from card/detail views.
  - QuesIQ now has an installable app manifest for standalone mobile launch.
  - Introduction Draft now refuses low-signal test/filler material before an AI
    call, and the active prompt is tightened to extract from user-provided facts
    instead of inventing role/company-specific background.
  - Realtime voice input now uses near-field noise reduction, a stricter
    server VAD threshold, longer silence detection, and disabled automatic
    response interruption so headset/cable noise is less likely to cut Que off.
  - Story Lab now separates Build and Library views so Introduction/TMAAT
    capture stays focused, resets draft/transcript state when switching between
    Introduction and TMAAT, fixes the mobile tab overflow, and shows TMAAT
    story detail in STAR order.
  - OpenAI calls now prefer product-specific keys for usage tracking:
    `OPENAI_INTERVIEW_API_KEY`, `OPENAI_INTERVIEW_REALTIME_API_KEY`,
    `OPENAI_STUDY_API_KEY`, `OPENAI_STUDY_REALTIME_API_KEY`,
    `OPENAI_DPE_API_KEY`, and `OPENAI_DPE_REALTIME_API_KEY`. Legacy shared
    `OPENAI_API_KEY` and `OPENAI_REALTIME_API_KEY` names remain code fallbacks
    during migration.
  - Realtime Interviewer prompt v4 now has a clearer instruction hierarchy,
    cleaner opening behavior, stronger mode/question/style composition,
    tighter turn-taking, and less risk of Que sounding like a product tutor.
  - Regular practice first-turn mode behavior now lives in Admin-visible prompt
    text instead of hidden client templates. Keep this as the prompt principle:
    behavior instructions belong in Admin prompt/config surfaces; code may pass
    context and minimal kickoff only.
  - Story Lab Introduction/TMAAT capture and verbal Debrief first-turn behavior
    now also live in Admin-visible prompt configs. Client/server code passes
    capture purpose and saved session context, not behavioral prompt text.
  - Practice mode prompt instructions are now more differentiated: First
    Impression is a first-minute opening drill, Coaching is a
    question-answer-coach-retry loop, Rapid Fire is paced repetition with
    minimal between-answer coaching, and Mock Interview avoids coaching until
    the post-session review.
  - Question type prompts are now more differentiated: Behavioral expects real
    examples and STAR evidence, Technical probes role-specific depth and
    judgment, Hypothetical tests structured scenario reasoning, and
    Motivational probes specific fit and realistic role interest.
  - Interviewer style prompts are now more differentiated: Friendly is warm
    and encouraging while still concrete, Neutral is steady and professional,
    and Tough challenges vague claims without becoming hostile.
  - Realtime End Session now stops the mic, commits pending audio for
    transcription, waits briefly for transcript completion, and finalizes
    without asking Que for a fresh response. If Que is already speaking, the
    End click cancels that active response.
  - AI Usage now logs prompt config links/snapshots/raw JSON metadata, and
    Realtime exchange setup calls are represented in AI Usage.
  - Admin Diagnostics captures failed API/client/Realtime events.
  - QuesIQ Study now has source-style picker routing, hands-free/TTS verbal and
    quiz behavior, AI-assisted import with AI Usage instrumentation, folder
    APIs, inline public toggle, stats/card edit polish, Study-prefixed library
    taxonomy tables, mapped audience-tag filtering, source taxonomy seed SQL,
    source-style folder manager/import/verbal/quiz polish, R2-backed TTS cache
    code, shared Interview-aligned Study shell controls, and `[TEST_DELETE]`
    Study library seed/cleanup SQL under `scripts/study/`.
  - QuesIQ Study now has first product-owned XP/quest progression tables,
    rule-driven XP awards from card ratings, starter Study quests, and a Study
    dashboard momentum panel.
  - QuesIQ brand assets are now split by product: shared icon, main platform
    logo, Interview product logo, and Study product logo under `public/brand/`.
- Local verification passed on 2026-05-29 with `npm run typecheck`,
  `npm run lint`, and `npm run build`.
- Best next move: commit/push the verified local work, deploy to `quesiq-web`,
  confirm migrations through `0049`, then QA Study library taxonomy
  seed/filter/cleanup behavior, Study permission boundaries, R2 TTS cache envs,
  and mobile visual behavior.

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

The latest Bubble-reference work moved three high-value gaps forward: richer
post-session review scaffolding, coaching memory, and verbal Debrief. Written
Debrief is no longer a separate user flow; written reflection belongs inside
the structured practice review, while Debrief now means a Realtime voice
conversation tied to a completed session. Saved Job Targets now have a clearer
owned slice: Me separates the user's coaching profile from reusable
role/company targets, while Practice uses the selected target as the situation
for a session. Users can now edit/delete saved targets, persist an active
target preference, and receive target-aware Home nudges for choosing the active
opportunity, adding notes, or practicing a target with no reviewed sessions yet.
Avoid treating Bubble parity as the goal; carry forward only features that
improve practice, feedback, retention, or beta learning.

Story Lab is the current active product surface. It now has separate
Introduction and TMAAT tabs, both using Talk with Que, Dictate, or Type entry
points. Introduction comes first, saved introductions are durable, and saved
intros can launch focused Intro Practice. The creation workflow is intentionally
lighter now: collect conversation/notes first, let Que draft the structured
script/fields, then save or edit the resulting introduction.

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
  rotates beta questions about review usefulness, voice realism, transcript
  accuracy, and scoring fairness after a newly generated practice review.
- Added sortable Admin table headers for Feedback, API Calls, and Realtime
  Sessions, and split Admin Feedback into Feedback and Bugs subtabs.
- Expanded AI Usage instrumentation so Story Lab follow-up, Story Lab outline,
  Introduction Draft, legacy written Debrief, and Realtime exchange endpoints
  create `ai_runs` rows. App-owned practice sessions continue to save richer
  Realtime usage after the voice artifact is persisted.
- AI run records now retain prompt config id, prompt key/version, prompt
  instruction snapshot, and safe raw JSON metadata. Admin AI Usage shows a
  Prompt column that can open the matching prompt config version.
- Added Admin Diagnostics visibility for failed same-origin API calls, rejected
  fetches, client browser errors, unhandled promise rejections, and Realtime
  connection/error events. The diagnostic log stores sanitized metadata only and
  is visible under Admin > Diagnostics.
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
  Story Lab where users can Tell Que in a Realtime story conversation, Dictate
  uninterrupted rough material, or Type as a fallback, then ask Que for a
  follow-up question and generate/save a reusable STARR-style story outline with
  categories, alternate spins, coach notes, and a practice prompt.
- Started Story Lab Phase 2 library polish: saved stories can be selected into
  a detail panel and edited after generation, with owner-scoped updates through
  `/api/stories/[storyId]`. Saved TMAAT stories can also be deleted from the
  card or detail view without removing historical practice sessions.
- Started Story Lab Phase 3 practice hooks: saved story cards open directly,
  the explicit action is now Edit Story, and saved story details can launch a
  Practice Story voice session with the story outline included in Que's Realtime
  prompt context and the post-session evaluation input.
- Added durable Story Practice coaching history: completed Story Practice
  reviews update the source Story with last-practiced date, practice count, and
  recent coaching summaries. Normal practice and evaluation prompt context now
  also includes a compact saved-story library so Que can suggest a better-fit
  story when the candidate answers with weaker material.
- Added the first saved Job Targets slice and separated its UI from Profile:
  Me now has a Profile panel for name/resume and a Job Targets panel for
  reusable role/company/job-description targets, Practice setup can choose a
  saved target before launch, Sessions remember the selected target id, and
  Home points users to Me & Targets instead of treating everything as one
  interview-context object.
- Polished saved Job Targets with true edit-by-id, delete, persisted active
  target preference on Profile, and target-aware Up Next nudges for selecting an
  active target, adding missing notes, and practicing the active opportunity.
- Added Story Lab prompt visibility in Admin: Story Conversation Realtime,
  follow-up, outline generation, Story Practice Realtime guidance, and Story
  Practice Evaluation guidance are now versioned prompt configs under Admin >
  Prompts > Base.
- Tightened mobile app chrome by removing the header readiness text and
  signed-in account name while keeping the logo and sign-out action.
- Added hideable mobile navigation: Story Lab is a primary nav item, the bottom
  nav can collapse into a small chevron Menu handle, the preference is stored
  locally, and desktop keeps the left navigation rail.
- Added the installable app baseline: QuesIQ publishes a web app manifest with
  the existing brand icon, standalone display mode, app colors, and root start
  URL so supported mobile browsers can launch it without browser chrome.
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
- Added verbal Debrief persistence: completed voice debrief calls save a
  transcript/event artifact in `voice_debriefs`, update debrief XP rules
  idempotently per session, and count toward debrief-count quests alongside
  legacy written debrief rows.
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
  rewards also use the rules table. Debrief completion rules now use saved
  verbal Debrief artifacts, and XP Events show rule metadata for visibility.
- Added an admin-only demo data seed endpoint/button for the Ronnie account:
  Admin > Data can create representative profile, story, session, evaluation,
  debrief, coaching memory, feedback, and progression rows when missing.
- Added Story Lab Introduction Builder as a second Story Lab tab before TMAAT:
  users can Talk with Que, Dictate, or Type, choose a Short/Medium/Long timing
  range, save multiple introductions, expand saved intro details, edit/delete
  saved intros, and launch Intro Practice with the selected intro in Que's
  Realtime context.
- Added durable saved Introduction storage in migration
  `0035_add_introductions.sql`, owner-scoped introduction API routes, intro
  practice evaluation context, intro practice coaching history, and progression
  quest checks for first saved Introduction and first saved TMAAT Story.
- Added the Introduction Builder AI draft/extraction slice: captured Talk with
  Que transcripts, dictated notes, or typed notes can call
  `/api/introductions/draft` to produce the polished script plus background,
  core strength, proof point, role interest, and closing handoff before save.
- Added the Admin-visible `introduction_draft` prompt config and migration
  `0036_add_introduction_draft_prompt.sql`.
- Cleaned up Story Lab creation UX after review: removed the up-front editable
  intro context fields from the initial builder, kept detail fields inside
  saved intro cards, moved Introduction before TMAAT, centered the top selector
  with dedicated styles, and made the TMAAT Talk with Que side mirror the
  transcript-first capture format.
- Added representative saved TMAAT stories and saved introductions to the Admin
  demo data seed so the library/detail/practice flows can be inspected without
  manually going through capture first.
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
- Latest local review/debrief prompt work passed ESLint, TypeScript check, and
  production build. Build output includes `/api/realtime/debrief`.
- Local `npm` is now available on PATH, and latest checks passed with it.
- Latest Story Lab Introduction/TMAAT cleanup passed ESLint, TypeScript check,
  and production build on 2026-05-28.
- Introduction Builder draft/extraction slice passed ESLint and TypeScript check
  on 2026-05-28.
- Rotating beta feedback prompts passed ESLint and TypeScript check on
  2026-05-28.
- Admin Diagnostics event logging slice passed ESLint and TypeScript check on
  2026-05-28.
- AI usage instrumentation audit for Story Lab, Introduction Builder, Realtime
  exchange endpoints, and legacy written Debrief passed ESLint and TypeScript
  check on 2026-05-28.
- AI run prompt link/snapshot/raw JSON metadata pass passed ESLint and
  TypeScript check on 2026-05-28.
- Saved Job Targets edit/delete/active-target and target-aware Up Next polish
  passed ESLint and TypeScript check on 2026-05-28.
- TMAAT story deletion and installable app manifest baseline passed ESLint and
  TypeScript check on 2026-05-28.
- Introduction Draft hallucination guard and interviewer-style intro capture
  prompt pass passed ESLint and TypeScript check on 2026-05-28.
- Realtime headset-noise/false-interruption tuning passed ESLint and TypeScript
  check on 2026-05-28.
- Story Lab Build/Library split, mobile tab cleanup, TMAAT STAR detail order,
  and patient TMAAT capture tuning passed ESLint, TypeScript check, and
  production build on 2026-05-28.
- Dedicated Realtime voice API key routing passed ESLint, TypeScript check, and
  production build on 2026-05-28.
- Realtime Interviewer v2 prompt and first-turn template refinement passed
  ESLint, TypeScript check, and production build on 2026-05-28.
- Admin prompt visibility cleanup for regular practice first-turn behavior
  passed ESLint, TypeScript check, and production build on 2026-05-28.
- Realtime End Session transcript-drain fix passed ESLint, TypeScript check,
  and production build on 2026-05-28.
- Story Lab/Debrief prompt visibility migration passed ESLint, TypeScript
  check, and production build on 2026-05-28.
- Practice mode prompt refinement passed ESLint, TypeScript check, and
  production build on 2026-05-28.
- Question type prompt refinement passed ESLint, TypeScript check, and
  production build on 2026-05-28.
- Interviewer style prompt refinement passed ESLint, TypeScript check, and
  production build on 2026-05-28.
- Realtime Interviewer base prompt v4 refinement passed ESLint, TypeScript
  check, and production build on 2026-05-28.
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
- Use `docs/README.md` as the docs map. `docs/rebuild/` is current truth,
  `docs/strategy/` is future planning, and `docs/reference/` is preserved
  historical context.
- Older OneDrive Bubble/rebuild files are reference copies, not a second source
  of truth unless intentionally resynced.
- QuesIQ Interview remains the lead coded product. Keep QuesIQ Study, shared
  billing, cross-product platform shell work, and shared Quira service-boundary
  work as later platform work unless `docs/rebuild/DECISIONS.md` changes.
- Auth.js identity is the generic account root. Keep Interview-specific product
  data in Interview tables keyed by `user_id`, and avoid adding
  product-specific fields to the generic `user` table.
- Keep design tokens and reusable UI patterns clean for future extraction, but
  do not create a separate design-system package before a second active product
  needs it.
- Direct OpenAI Realtime is the preferred first browser voice path.
- Default prompt configs are seeded with `gpt-realtime`/`marin` for interview
  voice and verbal Debrief, and `gpt-5.4-mini` for evaluation. After migration,
  the active Postgres prompt config is the editable runtime source.
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

1. Deploy/user-confirm QA the latest Story Lab, prompt, debrief, progression,
   job-target UI changes, and Study import work on `quesiq-web`. Confirm
   migrations through `0049_seed_study_library_taxonomy.sql` run before testing
   Introduction Builder, Intro Practice, verbal Debrief, Story Practice
   coaching history, Tell Que story capture, saved Job Targets, Admin
   Diagnostics, AI Usage prompt links/raw metadata, and Study library taxonomy.
2. Run/user-confirm Study library taxonomy QA: run
   `scripts/study/seed_test_decks.sql`, confirm mapped audience-tag filters in
   `/study/library`, then run `scripts/study/cleanup_test_decks.sql`.
3. Run/user-confirm database migration QA for the imported levels and quests:
   Progression > Levels shows Rookie through Master, Progression > Quests shows
   37 active quest definitions, level/quest edits save from Admin, and Home
   awards quest XP only once per quest.
4. User-confirm QA the Admin tab: Prompts, Modes, Questions, Styles, API Calls,
   Realtime Sessions, Pricing, Feedback/Bugs, Progression, Levels, and Data.
5. Keep monthly/scheduled pricing checks paused; use manual Admin pricing review
   only if needed.
6. Deploy/user-confirm progression QA: existing reviewed sessions backfill XP,
   new completed reviews award XP once, Home shows saved streak/level/latest
   next action, level thresholds load from Admin, and retry/reopen does not
   double-count.
7. QA scoring polish: Recent Scores reflects the latest 10 reviewed sessions,
   Skill Scores remains all-time, Overall is highlighted, and sub-120-second
   sessions appear in History without scoring or XP.
8. QA rotating post-review beta feedback prompts in production and confirm Admin
   Feedback stores the exact `rating_prompt` for review usefulness, voice
   realism, transcript accuracy, and scoring fairness.
9. Continue Story Lab QA: deploy/user-confirm the Practice Story voice flow,
   Intro Practice voice flow, hideable navigation, saved coaching history on
   Story records, saved intro coaching history, and top Introduction/TMAAT
   selector alignment across desktop and mobile.
10. QA Admin Diagnostics in production: trigger or observe a failed API response
   and a Realtime connection issue, then confirm the Diagnostics tab shows
   sanitized event rows without secrets, raw audio, or large transcripts.
11. QA the Introduction Builder AI draft/extraction step in production: after
   Talk with Que transcript capture, verify `/api/introductions/draft` runs,
   fills structured intro fields, and saves the polished introduction with raw
   notes retained.
12. Investigate any production `client.session.error` from the Story Lab
   Realtime entry points, starting with the Introduction Builder conversation
   endpoint.
13. QA installable app behavior on iOS and Android: add QuesIQ to the home
   screen, launch it, and confirm standalone mode uses the expected icon,
   splash/background color, and app start URL.
14. Consider mobile bottom-nav auto-hide later as a guarded UX experiment:
   visible by default, hide only on meaningful downward scroll, show
   immediately on upward scroll, and never hide during active voice/session,
   error, modal, save, or onboarding states.
15. Work the remaining highest-value Bubble reference gaps into upcoming phases:
   richer coaching memory controls, beta tuning for XP rules, and AI-backed
   Quira support.
16. Defer or avoid lower-value parity work until the beta needs it: standalone
   anonymous bug-report page, in-app marketing/blog pages, payments, industry
   packs, mascot work, and VAPI parity.
17. Later Quira work: replace the curated Help panel with an AI chat assistant
   that uses a maintained QuesIQ knowledge base and can submit structured bugs,
   feedback, screenshots, and current screen/session context.
18. Continue deploy/user-confirmed QA for changes because localhost preview is
   deprecated in this environment.
19. Keep verifying that `Launch Voice Session` creates a Session id before direct
   voice opens.
20. Establish the branch/release flow before broader live traffic: keep `main` as
    stable integration, create/confirm `live` from the actual production commit,
    and promote intentional releases from `main` to `live`.

## Watch Outs

- A test OpenAI key was previously stored locally in ignored `.env.local`;
  rotate any key that was shared during spike/test work before using it in
  production.
- For cleaner cost tracking, set product-specific OpenAI keys in `.env.local`
  and Render: Interview API/Realtime, Study API/Realtime, and DPE API/Realtime.
  Legacy shared OpenAI keys are fallback-only during migration.
- Prompt visibility principle: avoid meaningful hidden prompts in client/server
  code. Put behavior instructions in Admin prompt configs or Admin-visible
  component prompts; code should mainly pass runtime context and a minimal
  kickoff.
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
- The legacy `/api/debriefs` written-debrief endpoint and `debriefs` table still
  exist for now, but the user-facing flow has moved to verbal Debrief through
  `/api/realtime/debrief`. Do not build new written debrief UX unless product
  direction changes.
- `tsconfig.tsbuildinfo` is generated TypeScript cache and intentionally ignored.
- Migrations through `0049_seed_study_library_taxonomy.sql` must be applied
  before using the updated Story Lab and Study library taxonomy paths in
  production. The Render start command currently runs Drizzle migrations before
  `npm start`, so it should apply automatically on deploy, but verify it in
  Render logs before QA.
