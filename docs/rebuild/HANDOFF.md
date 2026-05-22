# Handoff

Last updated: 2026-05-22

## Current Focus

QuesIQ Interview has moved from the initial UI shell into a direct browser voice
spike. The practice wizard now hands a session setup snapshot into a focused
session screen, and a direct OpenAI Realtime test path works manually well enough
to prefer it over VAPI for the first coded browser beta.

## Done Since Last Handoff

- Refined responsive mobile and desktop app layouts.
- Added UI-only onboarding/interview context with required name/role and optional
  company, job description, and resume path.
- Split the interview UI into focused components and extracted practice types and
  seeded data.
- Added client-side session setup snapshot launch and placeholder session screen.
- Added direct OpenAI Realtime WebRTC voice spike from the session screen.
- Added server-only API key path via `/api/realtime/session` and `.env.example`.
- Added Que first-turn kickoff after the data channel opens.

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

1. Harden the voice spike into a real session surface and define its app-owned
   transcript/event handoff.
2. Choose auth plus ORM/migration direction and persist the first Session record
   before voice launch.
3. Decide the beta transcript/audio retention contract before evaluation work.

## Watch Outs

- A test `OPENAI_API_KEY` is currently stored locally in ignored `.env.local`;
  rotate the key after the spike/test cycle because it was shared in chat.
- Repeated `localhost:3000` preview attempts have been unreliable in this Codex
  environment and should not be the default verification path right now.
- `tsconfig.tsbuildinfo` is generated TypeScript cache and intentionally ignored.
