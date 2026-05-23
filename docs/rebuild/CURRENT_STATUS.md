# Current Status

Last updated: 2026-05-23

## Rebuild Location

- Local repo: `C:\Users\weeks\Documents\GitHub\QuesIQ`
- GitHub repo: `ronnieav8r/QuesIQ`
- Living rebuild docs: `docs/rebuild/`
- Active Render web service: `quesiq-web`
  - now points at `ronnieav8r/QuesIQ`
  - Render URL: `https://quesiq-web.onrender.com`
  - custom domain `https://quesiq.com` is the active live app
- Render Postgres for the rebuild: `quesiq-interview-db`
  - free test database in the Virginia Render region
  - `DATABASE_URL` is wired on `quesiq-web`
- `render.yaml` still describes the separate free Blueprint service
  `quesiq-interview-rebuild` until we decide whether to keep that path.
- Older Bubble handoffs and the older rebuild-doc copy in the OneDrive workspace
  are reference material unless deliberately resynced.

## Built So Far

- Rebuild plan, architecture, decisions, scope, and handoff docs
- Next.js TypeScript baseline and Render readiness files
- Responsive app shell with intentional mobile and desktop compositions
- Home, Practice, Stories, and Me navigation
- History navigation with owned session list
- UI-only onboarding/interview-context flow with a fast path into practice
- Refactored interview UI components and typed seeded practice data
- Practice setup wizard with mode-specific question-type routing
- Seeded backend Interview catalog records for practice modes, question types,
  and interviewer styles, exposed through `/api/catalog` with frontend fallback
  defaults
- Client-side session setup snapshot and focused voice session screen
- Direct OpenAI Realtime browser voice slice from the session screen:
  - server-side `/api/realtime/session` WebRTC exchange route
  - browser readiness, live, ended, and recoverable error states
  - Que first-turn kickoff
  - transcript and recent-event session surfaces
  - typed client artifact draft for transcript and lifecycle-event handoff
- Postgres Session launch persistence slice:
  - Drizzle ORM schema and first Session migration
  - `/api/sessions` creation route with setup-snapshot validation
  - practice launch waits for the app-owned Session record before voice
- Ended voice artifact persistence slice:
  - Session stores transcript turns, lifecycle events, start/end metadata, and
    the direct Realtime call id without storing audio
  - `/api/sessions/[sessionId]/artifact` validates and saves the browser draft
    after a voice attempt ends
  - Realtime exchange captures OpenAI WebRTC call correlation metadata from the
    server response boundary
- Auth.js ownership slice:
  - email magic-link, Google, and GitHub sign-in routes and Auth.js Drizzle
    tables are in code
  - email magic links use Brevo transactional email env vars
  - new app-owned Sessions store their authenticated user owner
  - Session creation, artifact save, and Realtime exchange require that owner
    before history, evaluation, and progression build on Session data
- First evaluation handoff:
  - ended Session transcript artifacts can produce an owned structured review
  - review stores five score dimensions, a coaching insight, and a next action
  - the session screen shows review progress after the voice artifact saves
  - default evaluation model is `gpt-5.4-mini`
- First owned history/review revisit path:
  - Home loads the signed-in user's recent app-owned Sessions from Postgres
  - completed saved reviews can be reopened after leaving the live session
    screen
- User-owned profile context persistence:
  - onboarding saves preferred name, target role, target company, job
    description, resume filename, and parsed resume text in Postgres
  - the app reloads saved profile context and uses it in future setup/session
    snapshots
  - resume upload currently parses TXT, MD, DOCX, and most PDFs with a 2 MB beta
    limit; raw file binaries are not retained yet
- Thin review hardening:
  - Sessions track evaluation status and last evaluation error
  - saved transcript artifacts mark reviews pending
  - review creation marks processing, completed, or failed
  - Home surfaces saved transcript sessions that need review retry
- First history/progression summary:
  - History tab lists owned sessions with review status and per-session average
  - created-only Sessions with no transcript/review are hidden from visible
    History
  - Home score strip calculates the five score averages from completed saved
    evaluations
  - Home derives simple XP, level progress, last-practiced text, latest next
    move, and Recommended Next from saved Sessions and evaluations

## Verification

The current coded app has passed:

- ESLint
- TypeScript check
- Next production build
- Latest local checks were run through the bundled Node runtime because local
  `npm`/`git` were not available on PATH in this shell.
- Render deploy log verification on 2026-05-22 for `quesiq-web`:
  - QuesIQ build succeeded on the persistence commit
  - `npm run db:migrate` ran
  - the first Drizzle migration applied successfully
  - Next started successfully while the service update was still settling
- Live `quesiq.com` QA passed after the Auth.js and evaluation deploys:
  - GitHub sign-in works.
  - Email magic-link sign-in is wired in code and needs deployed Brevo/env QA.
  - Google sign-in is wired in code and needs deployed OAuth/env QA.
  - Owned Session launch works.
  - Session UUID appears before voice starts.
  - Direct Realtime voice starts and ends normally.
  - Voice Artifact saves.
  - Practice Review becomes ready with five scores, Coach Note, and Next Move.
  - Saved reviews reopen from Home and History.
  - Saved review detail includes expandable Transcript.
  - Profile context persists and reloads.
  - History and Home score/progression summaries render correctly.
  - Retry Review was manually confirmed working.
  - Created-only/incomplete Sessions are hidden from visible History.
  - Signed-out practice launch is blocked by design.
- Manual direct OpenAI Realtime spike test on 2026-05-22:
  - Que starts the practice
  - audio quality is acceptable
  - recent events and transcript turns appear
  - disconnect stops the session cleanly

Ignored local/generated paths currently include `.env.local`, `.next/`,
`.tools/`, `node_modules/`, and `tsconfig.tsbuildinfo`.

## Current Product Direction

- Replace Bubble for the core QuesIQ Interview app.
- Use direct OpenAI Realtime first for the coded browser voice beta.
- Keep VAPI as a fallback if direct voice testing reveals a quality,
  reliability, transcript, or tooling gap.
- Keep Make for automation edges, not the interview session state machine.
- Que is the in-app coach. Quira remains the separate public/support assistant.
- Keep QuesIQ-owned session snapshots, transcripts/artifacts, evaluations,
  history, and progression in the app backend/data layer.
- Resume files are uploaded through signed-in onboarding and parsed into profile
  resume text for Que and post-session evaluation. The app stores resume
  metadata and parsed text, not raw resume file binaries or object-storage keys.
- Build both mobile and desktop intentionally while keeping practice setup and
  live voice focused.

## Next Work

1. Deploy and user-confirm QA the resume-aware practice and catalog slices on
   `quesiq-web`.
2. Decide whether persisted progression/streak records or the next multi-module
   foundation should follow.
3. Continue deploy-based QA on `quesiq-web` while localhost preview is
   deprecated until we intentionally fix it.

## Reference Inputs

- Bubble/Claude handoff:
  `C:\Users\weeks\OneDrive\Documents\QuesIQ\claude_handoffs\interview_prep_app_project_state (4).md`
- Living rebuild docs in this repo:
  `docs/rebuild/REBUILD_PLAN.md`
  `docs/rebuild/ARCHITECTURE.md`
  `docs/rebuild/PRODUCT_SCOPE.md`
  `docs/rebuild/DECISIONS.md`
  `docs/rebuild/HANDOFF.md`
