# Next Steps

Last updated: 2026-05-23

## Current State

- The rebuild lives in `C:\Users\weeks\Documents\GitHub\QuesIQ`.
- Responsive dashboard, onboarding/context UI, and practice setup are in code.
- Practice setup creates a client-side session setup snapshot, persists the first
  app-owned Session launch record, and opens a focused voice session screen.
- A direct OpenAI Realtime browser voice slice is wired into that session screen
  with client artifact drafting and passed its first manual test.
- Ended direct voice attempts now save transcript/event artifacts and Realtime
  call correlation metadata on the app-owned Session without storing audio.
- Auth.js GitHub sign-in and Drizzle ownership tables are wired so new Sessions
  require an authenticated owner before saved practice launches.
- The first evaluation handoff is in code: saved transcript artifacts can create
  an owned structured review with five QuesIQ score dimensions.
- The first owned history/review revisit path is in code: Home loads recent
  signed-in Sessions and opens completed saved reviews after leaving the live
  session screen.
- The deployed app on `quesiq.com` has passed the owned practice loop:
  sign-in, Session-before-voice, direct voice, artifact save, and review ready.
- Active Render deployment path is moving onto `quesiq-web`, now pointed at
  `ronnieav8r/QuesIQ` with Render Postgres `quesiq-interview-db`.
- Render MCP is connected for service, deploy, log, Postgres, and environment
  inspection.
- Bubble reference material remains in the older OneDrive workspace.

## Immediate

1. Persist onboarding/profile context and reuse it in setup.
2. Decide whether review creation should stay inline after voice save or move
   to a queued/retryable server job.
3. Prefer deploy-based or user-confirmed QA. Localhost preview is deprecated on
   any port until we intentionally invest time to fix it.

## First Implementation Backlog

- Persist onboarding/profile context
- Persist seeded practice mode, question type, and interview style records where
  useful for the backend
- Add richer owned session history filters and review summaries
- Keep Session artifact storage transcript/event-first until audio retention is
  intentionally revisited
- Add a simple completed-session list and review detail surface

## First Direct Voice Backlog

- Keep the server-mediated OpenAI Realtime WebRTC exchange route
- Improve first-turn and start/end UX for Que
- Capture transcript/events for app-owned session artifacts
- Decide whether to store audio, transcript only, or derived excerpts for beta
- Tune the first-turn, transcript, and review handoff after beta testing
- Keep VAPI as fallback, not the default implementation path

## Things Not To Do First

- Do not add a second core voice provider path before direct Realtime is tested
  through the next slice.
- Do not port every Bubble screen blindly.
- Do not bury the first voice practice session behind optional profile work.
- Do not make Make the core state machine for interview sessions.
