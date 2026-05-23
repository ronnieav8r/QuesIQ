# Next Steps

Last updated: 2026-05-23

## Current State

- The rebuild lives in `C:\Users\weeks\Documents\GitHub\QuesIQ`.
- Responsive dashboard, onboarding/context UI, and practice setup are in code.
- Practice setup creates a client-side session setup snapshot, persists the first
  app-owned Session launch record, and opens a focused voice session screen.
- Practice modes, question types, and interviewer styles now live in seeded
  backend catalog tables and load through `/api/catalog`, with frontend defaults
  as a fallback.
- A direct OpenAI Realtime browser voice slice is wired into that session screen
  with client artifact drafting and passed its first manual test.
- Ended direct voice attempts now save transcript/event artifacts and Realtime
  call correlation metadata on the app-owned Session without storing audio.
- Auth.js Google/GitHub sign-in and Drizzle ownership tables are wired so new
  Sessions require an authenticated owner before saved practice launches.
- The first evaluation handoff is in code: saved transcript artifacts can create
  an owned structured review with five QuesIQ score dimensions.
- The first owned history/review revisit path is in code: Home loads recent
  signed-in Sessions and opens completed saved reviews after leaving the live
  session screen.
- User-owned profile context persistence is in code: onboarding saves context to
  Postgres and the app reloads it for future setup/session snapshots.
- Thin review hardening is in code: Sessions track evaluation status/error,
  saved transcript sessions can show pending/failed review states, and missing
  or failed reviews can be retried from the saved review surface.
- First history/progression summary is in code: History lists owned sessions,
  status, and per-session average, while Home shows five score averages from
  completed evaluations.
- Home now derives simple XP, level progress, last-practiced text, latest next
  move, and Recommended Next from saved Sessions and evaluations.
- Created-only/incomplete Sessions are hidden from visible History.
- Resume upload now persists metadata and parsed text to the signed-in Profile
  record for TXT, MD, DOCX, and most PDFs. Parsed resume context is copied into
  session snapshots and used by Que plus the saved review handoff.
- Raw resume file binaries and object-storage-backed file retention are not
  wired yet.
- The deployed app on `quesiq.com` has passed the owned practice loop:
  sign-in, Session-before-voice, direct voice, artifact save, and review ready.
- Active Render deployment path is moving onto `quesiq-web`, now pointed at
  `ronnieav8r/QuesIQ` with Render Postgres `quesiq-interview-db`.
- Render MCP is connected for service, deploy, log, Postgres, and environment
  inspection.
- Bubble reference material remains in the older OneDrive workspace.

## Immediate

1. Add Render Google OAuth environment variables, deploy, and user-confirm QA
   Google sign-in plus the existing resume-aware practice and catalog slices.
2. Decide whether persisted progression/streak records or the next multi-module
   foundation should follow.
3. Prefer deploy-based or user-confirmed QA. Localhost preview is deprecated on
   any port until we intentionally invest time to fix it.

## First Implementation Backlog

- Decide whether resume binaries need object storage after the parsed-text beta
  slice proves useful
- Add richer owned session history filters if the 50-session list becomes too
  noisy
- Persist progression/streak records if derived XP/level is not enough
- Keep Session artifact storage transcript/event-first until audio retention is
  intentionally revisited

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
