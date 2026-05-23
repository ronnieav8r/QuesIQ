# Handoff

Last updated: 2026-05-23

## Current Focus

QuesIQ Interview now has the first owned practice loop live on `quesiq.com`:
GitHub sign-in, Session-before-voice launch, direct OpenAI Realtime voice,
voice artifact persistence, and a structured post-session practice review.

The next useful product slice is richer progression/history now that the owned
practice loop, profile context, and retryable review path are in place.

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
- Render logs on 2026-05-22 showed the QuesIQ persistence deploy build
  succeeded, Drizzle migrations applied successfully, and Next started.
- Live `quesiq.com` QA passed after Auth.js and evaluation deploys:
  - GitHub sign-in works.
  - Practice launch creates an owned Session before the voice screen opens.
  - The voice screen shows a real Session UUID.
  - Direct Realtime voice starts and ends normally.
  - Voice Artifact moves to Saved.
  - Practice Review moves to Ready and shows five scores, Coach Note, and Next
    Move.
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
- Default interview model is `gpt-realtime` unless `OPENAI_REALTIME_MODEL`
  overrides it.
- Default evaluation model is `gpt-5.4-mini` unless
  `OPENAI_EVALUATION_MODEL` overrides it.
- VAPI is a fallback path, not the default path, while phone calls are out of
  scope.
- QuesIQ should own durable user context, session snapshots, transcript/artifact
  records, evaluation, history, and progression.

## Next Best Work

1. Add richer progression/history summaries now that completed and pending
   review states are visible.
2. Keep verifying that `Launch Voice Session` creates a Session id before direct
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
