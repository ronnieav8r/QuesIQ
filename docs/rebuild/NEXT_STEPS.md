# Next Steps

Last updated: 2026-05-27

## Current State

- The rebuild lives in `C:\Users\weeks\Documents\GitHub\QuesIQ`.
- Responsive dashboard, onboarding/context UI, and practice setup are in code.
- Story Lab now supports voice-first messy capture, AI follow-ups, AI-generated
  STARR-style outlines, saved story library/detail/editing, and a first
  Practice Story voice hook.
- Story Lab, story generation, and story-practice prompts are Admin-visible as
  versioned prompt configs.
- Mobile navigation is hideable: Story Lab is a primary destination, the bottom
  nav can collapse into a small Menu handle, and desktop keeps the left rail.
- Admin is now available from the hamburger menu instead of inside Me, and Me is
  also available from that menu. Admin remains gated by `ADMIN_EMAILS`.
- Written Debrief has been removed from the user flow. Debrief now means a
  Realtime voice conversation launched from History or from the bottom of an
  expanded saved review.
- The post-session evaluation prompt now carries richer Bubble-inspired review
  guardrails: five locked dimensions, role-relative scoring, score evidence,
  next steps, review detail sections, and coaching memory updates in the same
  model call.
- Coaching memory is stored per user and is passed quietly into future practice
  sessions and verbal Debriefs.
- Completed verbal Debriefs now persist transcript/event artifacts in
  `voice_debriefs` and can award debrief XP/count debrief quests once per
  source session.
- Home has richer Up Next routing for pending reviews, missing context/resume,
  verbal Debrief, weak-score practice, Story Lab, quests, and default practice.
- XP rules are editable in Admin > Progression > XP Rules, with review rewards
  weighted more toward duration and score than flat completion.
- Admin > Data includes a Ronnie demo-data seeding button for representative
  empty-table rows.
- Practice setup creates a client-side session setup snapshot, persists the first
  app-owned Session launch record, and opens a focused voice session screen.
- Practice modes, question types, and interviewer styles now live in seeded
  backend catalog tables and load through `/api/catalog`, with frontend defaults
  as a fallback.
- Realtime interviewer and post-session evaluation prompts now live in
  versioned backend prompt config records, with an `ADMIN_EMAILS`-gated Admin
  tab for viewing versions, saving drafts, and activating versions.
- Practice modes, question types, and interviewer styles now have editable
  prompt instructions that are composed into Realtime and evaluation calls.
- Admin is organized into Prompts and AI Usage. Evaluation calls create
  Admin-visible exact-token API call records, and Realtime voice sessions create
  compact estimated usage records with duration, transcript split, model, voice,
  estimated audio tokens, estimated cost, pricing version, and estimation
  method.
- AI pricing records are editable in Admin, and both exact-token API call costs
  and estimated Realtime costs use active pricing records.
- Monthly AI pricing reviews are triggerable from Admin and schedulable through
  `/api/pricing/review` with `PRICING_CHECK_SECRET`. They should be treated as
  advisory only for now; pricing edits stay manual.
- A direct OpenAI Realtime browser voice slice is wired into that session screen
  with client artifact drafting and passed its first manual test.
- Ended direct voice attempts now save transcript/event artifacts and Realtime
  call correlation metadata on the app-owned Session without storing audio.
- Auth.js email magic-link plus Google/GitHub sign-in and Drizzle ownership
  tables are wired so new Sessions require an authenticated owner before saved
  practice launches.
- Signed-out users now land on the sign-in screen; app tabs are hidden until
  Auth.js reports a signed-in user.
- The first evaluation handoff is in code: saved transcript artifacts can create
  an owned structured review with five QuesIQ score dimensions plus richer
  written review-detail sections.
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
- Home now reads durable progression where available and shows level, XP,
  streak, quests, score summaries, coaching memory, and richer Recommended Next
  routing from saved Sessions, evaluations, stories, and profile context.
- Created-only/incomplete Sessions are hidden from visible History.
- Resume upload now persists metadata and parsed text to the signed-in Profile
  record for TXT, MD, DOCX, and most PDFs. Parsed resume context is copied into
  session snapshots and used by Que plus the saved review handoff.
- Raw resume file binaries and object-storage-backed file retention are not
  wired yet.
- The deployed app on `quesiq.com` has passed the owned practice loop:
  email/Google/GitHub sign-in, Session-before-voice, direct voice, artifact save,
  and review ready.
- Active Render deployment path is moving onto `quesiq-web`, now pointed at
  `ronnieav8r/QuesIQ` with Render Postgres `quesiq-interview-db`.
- Render MCP is connected for service, deploy, log, Postgres, and environment
  inspection.
- Bubble reference material remains in the older OneDrive workspace.

## Immediate

1. Deploy the current branch and confirm Render runs the newest migrations,
   especially `drizzle/0028_refine_session_evaluation_prompt.sql` and
   `drizzle/0030_add_voice_debriefs.sql`.
2. User-confirm the new review output on production: a new completed practice
   session should show score evidence/next steps in the stored JSON and visible
   review-detail sections on the review page.
3. User-confirm verbal Debrief on production: History > Voice Debrief and saved
   review > Start Voice Debrief should open a Realtime call that uses the
   selected session transcript/review without creating a new scored practice
   session, then save a verbal Debrief artifact after the call ends.
4. Confirm Admin > Prompts shows one active Post-Session Evaluation prompt
   version and one active Session Debrief prompt version after migrations.
5. Confirm Admin > Progression > XP Rules reflects the newer score/duration
   weighted rules and that reviewed sessions award rule-based XP once.
6. Keep pricing updates manual until candidate preview/writeback or a
   deterministic pricing parser is built.
7. Prefer deploy-based or user-confirmed QA. Localhost preview is deprecated on
   any port until we intentionally invest time to fix it.

## First Implementation Backlog

- Decide whether resume binaries need object storage after the parsed-text beta
  slice proves useful
- Add richer owned session history filters if the 50-session list becomes too
  noisy
- Add saved Job Targets and route practice/Up Next through a selected target
- Add daily Google Sheets export for AI run rows once the Admin run data is
  confirmed useful
- Keep the Render monthly pricing-review cron suspended unless manual pricing
  review is deliberately resumed
- Add candidate preview/checkboxes before allowing AI pricing-review writeback,
  or replace the AI review with a deterministic parser for the developer pricing
  page
- Polish the Brevo magic-link email template/HTML once auth behavior is stable
- Keep Session artifact storage transcript/event-first until audio retention is
  intentionally revisited

## First Direct Voice Backlog

- Keep the server-mediated OpenAI Realtime WebRTC exchange route
- Improve first-turn and start/end UX for Que
- Capture transcript/events for app-owned session artifacts
- Decide whether to store audio, transcript only, or derived excerpts for beta
- Tune the first-turn, transcript, and review handoff after beta testing
- Tune the verbal Debrief first turn and decide whether multiple debrief
  attempts per source session should be retained instead of replacing the latest
  saved artifact
- Keep VAPI as fallback, not the default implementation path

## Things Not To Do First

- Do not add a second core voice provider path before direct Realtime is tested
  through the next slice.
- Do not port every Bubble screen blindly.
- Do not bury the first voice practice session behind optional profile work.
- Do not make Make the core state machine for interview sessions.
