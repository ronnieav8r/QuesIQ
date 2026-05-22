# Next Steps

Last updated: 2026-05-22

## Current State

- The rebuild lives in `C:\Users\weeks\Documents\GitHub\QuesIQ`.
- Responsive dashboard, onboarding/context UI, and practice setup are in code.
- Practice setup creates a client-side session setup snapshot, persists the first
  app-owned Session launch record, and opens a focused voice session screen.
- A direct OpenAI Realtime browser voice slice is wired into that session screen
  with client artifact drafting and passed its first manual test.
- Active Render deployment path is moving onto `quesiq-web`, now pointed at
  `ronnieav8r/QuesIQ` with Render Postgres `quesiq-interview-db`.
- Render MCP is connected for service, deploy, log, Postgres, and environment
  inspection.
- Bubble reference material remains in the older OneDrive workspace.

## Immediate

1. Decide the minimum transcript/artifact storage contract needed for evaluation.
2. Capture direct Realtime correlation metadata with the Session record.
3. Add Auth.js user ownership before history/progression depends on it.
4. Confirm `quesiq-web` reaches live and verify Session-before-voice launch on
   the deployed app.
5. Prefer deploy-based or user-confirmed QA. Localhost preview is deprecated on
   any port until we intentionally invest time to fix it.

## First Implementation Backlog

- Persist onboarding/profile context
- Persist seeded practice mode, question type, and interview style records where
  useful for the backend
- Extend Session persistence after the first launch record
- Store session setup snapshot and direct Realtime correlation metadata
- Add placeholder review/history direction after session artifacts exist

## First Direct Voice Backlog

- Keep the server-mediated OpenAI Realtime WebRTC exchange route
- Improve first-turn and start/end UX for Que
- Capture transcript/events for app-owned session artifacts
- Decide whether to store audio, transcript only, or derived excerpts for beta
- Add evaluation handoff after completed voice sessions
- Keep VAPI as fallback, not the default implementation path

## Things Not To Do First

- Do not add a second core voice provider path before direct Realtime is tested
  through the next slice.
- Do not port every Bubble screen blindly.
- Do not bury the first voice practice session behind optional profile work.
- Do not make Make the core state machine for interview sessions.
