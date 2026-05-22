# Handoff

Last updated: 2026-05-22

## Current Focus

QuesIQ Interview has moved from the initial UI shell into the first direct
browser voice slice. The practice wizard now hands a session setup snapshot into
a focused session screen, and the direct OpenAI Realtime path works manually well
enough to prefer it over VAPI for the first coded browser beta.

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
- Updated the Render Blueprint to provision Postgres, wire `DATABASE_URL`, and
  run Drizzle migrations before deploy start.

## Verified

- ESLint passed.
- TypeScript check passed.
- Next production build passed.
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
- VAPI is a fallback path, not the default path, while phone calls are out of
  scope.
- QuesIQ should own durable user context, session snapshots, transcript/artifact
  records, evaluation, history, and progression.

## Next Best Work

1. Decide the beta transcript/audio retention contract before evaluation work.
2. Capture direct Realtime correlation metadata on the Session record.
3. Add Auth.js user ownership before history/progression depends on it.

## Watch Outs

- A test `OPENAI_API_KEY` is currently stored locally in ignored `.env.local`;
  rotate the key after the spike/test cycle because it was shared in chat.
- Localhost preview is deprecated on any port in this Codex environment until
  we intentionally invest time to fix it. Prefer deploy-based or
  user-confirmed QA instead.
- `tsconfig.tsbuildinfo` is generated TypeScript cache and intentionally ignored.
