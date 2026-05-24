# Handoff

Last updated: 2026-05-23

## Current Focus

QuesIQ Interview now has the first owned practice loop live on `quesiq.com`:
email magic-link plus OAuth sign-in, Session-before-voice launch, direct
OpenAI Realtime voice,
voice artifact persistence, a structured post-session practice review, saved
review revisit, profile persistence, history, score summaries, and first derived
progression.

The next useful product slice is deploying and QAing the admin prompt config
panel, then deciding whether persisted progression/streak records or
cost/observability hardening should follow.

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
- Next production build passed.
- Local checks for the latest slices passed using the bundled Node runtime
  because local `npm`/`git` were not available on PATH in this shell.
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

1. Deploy and user-confirm QA for the Admin prompt config panel and AI Usage
   tabs.
2. Add `ADMIN_EMAILS` to Render before trying the Admin tab.
3. Decide whether persisted progression/streak records or cost/observability
   hardening should follow.
4. Add deploy/user-confirmed QA for any changes because localhost preview is
   deprecated in this environment.
5. Keep verifying that `Launch Voice Session` creates a Session id before direct
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
- `tsconfig.tsbuildinfo` is generated TypeScript cache and intentionally ignored.
