# Next Steps

Last updated: 2026-05-22

## Current State

- The rebuild lives in `C:\Users\weeks\Documents\GitHub\QuesIQ`.
- Responsive dashboard, onboarding/context UI, and practice setup are in code.
- Practice setup creates a client-side session setup snapshot and launches a
  focused placeholder session screen.
- A direct OpenAI Realtime browser voice spike is wired into that session screen
  and passed its first manual test.
- Render deployment files are in the GitHub repo.
- Bubble reference material remains in the older OneDrive workspace.

## Immediate

1. Harden the direct OpenAI voice spike into the first real voice slice:
   microphone readiness, better error states, live/ended UI, and owned session
   transcript/event handling.
2. Choose auth provider and ORM/migration tool when persistence work begins.
3. Create the first app-owned Session record before voice launch and persist the
   immutable setup snapshot.
4. Decide the minimum transcript/artifact storage contract needed for evaluation.
5. Prefer deploy-based or user-confirmed QA over repeated `localhost:3000`
   preview attempts until local preview reliability is addressed separately.

## First Implementation Backlog

- Persist onboarding/profile context
- Persist seeded practice mode, question type, and interview style records where
  useful for the backend
- Create Session record before voice launch
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
