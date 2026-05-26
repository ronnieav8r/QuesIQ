# Current Status

Last updated: 2026-05-25

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
- Admin-only prompt config slice:
  - `ADMIN_EMAILS` gates admin access by signed-in email
  - Realtime interviewer and post-session evaluation prompts are stored as
    versioned Postgres records
  - practice modes, question types, and interviewer styles now have editable
    prompt instructions
  - the Admin tab can view versions, save drafts, and activate a version
  - Realtime calls compose base prompt, mode instructions, question-focus
    instructions, style instructions, and user/session context
  - Evaluations receive the same mode/style/question prompt context alongside
    job, resume, and transcript context
  - Realtime Sessions and Evaluations record the base prompt config version used
- Admin AI Runs visibility:
  - Admin is now organized into Prompts and AI Usage, with sub-tabs for base
    prompts, modes, questions, styles, API calls, and Realtime sessions
  - post-session evaluation attempts create AI run records with status, model,
    prompt config version, provider response id, duration, errors, and exact
    token counts when OpenAI returns `usage`
  - Realtime voice sessions create compact usage records from saved artifacts:
    duration, transcript split, model, voice, prompt version, estimated audio
    tokens, estimated cost, pricing version, and estimation method
  - Realtime cost estimates use configurable audio-token-per-minute assumptions
    and can be audited/adjusted over time
  - AI pricing records are editable in Admin under AI Usage > Pricing, and cost
    calculations now read active pricing records instead of hardcoded rates
  - monthly AI pricing review is triggerable from Admin and through
    `/api/pricing/review`; it uses OpenAI web search plus structured JSON to
    compare current app pricing against
    `https://developers.openai.com/api/docs/pricing`
  - pricing review writeback was explored, but pricing updates should remain
    manual for now because live AI review results were inconsistent
  - Render monthly cron `quesiq-monthly-pricing-review` is suspended/deprecated
    for now because it was not working cleanly and redeployed after every build;
    use manual Admin pricing review only if needed
- First global beta feedback slice:
  - signed-in users can open a Feedback button from any screen
  - the lightweight dialog supports bug or feedback, 1-5 rating, and an
    optional short note
  - users can attach an optional screenshot for bug/feedback reports during the
    beta while object storage is not yet in place
  - the rating prompt is shown above the stars so each submission preserves what
    the user was asked to rate
  - a one-time popup now appears when a newly completed practice review is ready
    and asks the user to rate review usefulness
  - submissions store user ownership, current screen, optional session id,
    browser language, viewport, user agent, rating prompt, and screenshot
    metadata/data in Postgres
  - Admin has Feedback and Bugs subtabs for recent submissions, and the
    Feedback, API Calls, and Realtime Sessions tables have sortable headers
  - Admin spreadsheet-style tables keep headers on one line, truncate long
    fields by default, and let admins click truncated cells to expand full text
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
  - signed-out users land on a dedicated sign-in screen; app tabs are available
    only after sign-in
  - Google OAuth can link to an existing email magic-link account with the same
    verified email
  - new app-owned Sessions store their authenticated user owner
  - Session creation, artifact save, and Realtime exchange require that owner
    before history, evaluation, and progression build on Session data
- First evaluation handoff:
  - ended Session transcript artifacts can produce an owned structured review
  - review stores five score dimensions, a coaching insight, and a next action
  - the session screen shows review progress after the voice artifact saves
  - default evaluation config is seeded as `gpt-5.4-mini` and can be edited
    through the admin prompt config panel
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
  - Home initially derived simple XP, level progress, last-practiced text,
    latest next move, and Recommended Next from saved Sessions and evaluations
- Durable progression persistence:
  - reviewed sessions create idempotent progression events worth XP
  - user progression summaries persist total XP, level, current level XP,
    streak, longest streak, completed review count, latest next action, and
    weakest score
  - Home now reads the saved progression summary with derived history as a
    fallback while loading
  - first progression load can backfill events from existing completed
    evaluations so earlier reviewed sessions count
  - Admin has a Progression section with Users and XP Events subtabs for
    visibility into saved summaries and event ledger updates
  - Admin Progression now includes editable level thresholds, and level math
    reads the threshold table instead of fixed hardcoded thresholds
  - Admin has a Data section for inspecting Users, Profiles, Sessions, and
    Evaluations without direct database access
- UI modernization Phase 1A foundation:
  - added global design tokens for spacing, typography, radius, surface colors,
    soft shadow, and fast transitions
  - normalized base buttons, inputs, app shell, panels/cards, tabs, tables, and
    feedback dialog primitives around those tokens
  - preserved current screen structure and product behavior
- UI modernization Phase 1B core user-screen cleanup:
  - tightened mobile rhythm across Home, Practice, Session/Review, History, Me,
    Auth, and Onboarding surfaces through shared CSS
  - small-screen session/context detail rows now stack instead of squeezing
    label/value pairs
  - session headings and readiness panels stack more cleanly on narrow phones
  - feedback launcher moves above bottom navigation on narrow phones
  - live session copy is more user-facing and less implementation-oriented
- UI modernization Phase 2A text-first navigation refinement:
  - primary navigation is now Home, Practice, History, and Me
  - Stories and Admin moved behind Me, with Admin still gated by admin access
  - secondary views keep Me highlighted in the primary nav
  - the Quira launcher clears the bottom nav on mobile-sized viewports
- UI modernization Phase 2B icon polish:
  - added `lucide-react`
  - wired Home, Practice, History, and Me icons into the primary nav
  - kept labels visible on mobile and desktop
  - preserved the four-item single-row mobile bottom nav
- Brand assets:
  - copied the QuesIQ icon-only and Interview logo PNGs into `public/brand/`
  - app shell header now uses the full QuesIQ Interview logo
  - app metadata uses the icon-only mark for browser/app icons
- Bubble progression import:
  - level thresholds are seeded from the Bubble export as 15 titled levels:
    Rookie through Master
  - quests are seeded from the revised Bubble export as 37 active milestone
    definitions with stable quest keys, titles, checks, and XP rewards
  - user quest completions are stored separately and award XP through the
    existing progression event ledger with `quest_completed` events
  - Home now shows quest progress, and Admin > Progression includes quest
    visibility
  - Admin can add/edit both level thresholds and quest definitions
- Scoring polish:
  - Home now shows Recent Scores for the latest 10 reviewed sessions separately
    from all-time Skill Scores
  - both score sections include a highlighted calculated Overall score
  - the underlying AI review rubric remains the same five dimensions
  - sessions under 120 seconds are saved and shown in History as too short to
    score, but do not generate evaluations, score averages, review XP, or review
    retry prompts
- Embedded Quira support baseline:
  - global support now uses a small Quira launcher instead of a plain Feedback
    button
  - Quira offers Help, Feedback, and Bug paths from any signed-in screen
  - Help currently uses curated QuesIQ product guidance for core workflows and
    can capture unanswered questions for the team
  - Feedback and Bug paths continue to save rating, note, optional screenshot,
    screen, session id, browser language, viewport, and user agent through the
    existing feedback storage/admin path
  - this is intentionally only a baseline; the target future Quira experience
    is an AI chat bot that calls a model, holds a support conversation, walks
    users through QuesIQ, and handles minor troubleshooting

## Verification

The current coded app has passed:

- ESLint
- TypeScript check
- Latest local feedback/progression/UI foundation/user-screen cleanup/Quira
  baseline checks passed with ESLint, TypeScript, and production build.
- Next production build
- Latest local checks passed with local `npm` available on PATH.
- Render deploy log verification on 2026-05-22 for `quesiq-web`:
  - QuesIQ build succeeded on the persistence commit
  - `npm run db:migrate` ran
  - the first Drizzle migration applied successfully
  - Next started successfully while the service update was still settling
- Live `quesiq.com` QA passed after the Auth.js and evaluation deploys:
  - GitHub sign-in works.
  - Email magic-link sign-in works.
  - Google sign-in works and linked to the existing Gmail-backed account.
  - Signed-out users land on the sign-in screen instead of the app Home view.
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
- Que is the in-app interview coach. Quira is the product/support assistant.
- For V1, Quira is implemented inside QuesIQ rather than deployed as a separate
  Render service. The current Quira surface is only a baseline launcher/support
  panel; the desired future version is an AI-backed chat bot and QuesIQ product
  expert. Keep the UI/data boundaries clean so she can become a shared service
  later if multiple products need her.
- UI modernization is active and incremental. Phase 1A established global
  design tokens/base styling. Phase 1B cleaned up core user-screen rhythm,
  small-screen behavior, and user-facing copy. Phase 2A completed text-first
  navigation refinement, and Phase 2B added lucide icons to the primary nav.
- Progression now combines reviewed-session XP with imported Bubble quest XP.
  Quest completion is idempotent through `user_quests`; XP accounting remains in
  `progression_events`.
- Keep QuesIQ-owned session snapshots, transcripts/artifacts, evaluations,
  history, and progression in the app backend/data layer.
- Resume files are uploaded through signed-in onboarding and parsed into profile
  resume text for Que and post-session evaluation. The app stores resume
  metadata and parsed text, not raw resume file binaries or object-storage keys.
- Build both mobile and desktop intentionally while keeping practice setup and
  live voice focused.

## Next Work

1. Deploy and user-confirm QA the Admin, feedback/bug, progression, UI Phase 2,
   and Quira baseline slices on `quesiq-web`.
2. Run/user-confirm migration QA for Bubble levels and quests: Admin >
   Progression > Levels shows Rookie through Master, Admin > Progression >
   Quests shows 37 active definitions, Admin level/quest edits save, and Home
   awards quest XP once per quest.
3. Add/confirm `ADMIN_EMAILS` in Render before QAing Admin; monthly pricing
   checks are suspended/deprecated, so `PRICING_CHECK_SECRET` is not an active
   QA blocker unless manual pricing-review endpoint testing resumes.
4. Keep pricing updates manual until candidate preview/writeback or a
   deterministic pricing parser is built.
5. Deploy/user-confirm progression QA: existing reviewed sessions backfill XP,
   new completed reviews award XP once, Home shows saved streak/level/latest
   next action, level thresholds load from Admin, and retry/reopen does not
   double-count.
6. QA scoring polish: Recent Scores uses the latest 10 reviews, Skill Scores is
   all-time, Overall is highlighted, and sub-120-second sessions appear in
   History without scoring or XP.
7. Expand prompted micro-feedback beyond the first review-usefulness popup by
   rotating specific questions about AI voice realism, transcript accuracy, and
   scoring fairness.
8. Later Quira work: replace the curated Help panel with an AI chat bot backed
   by a maintained QuesIQ product knowledge base.
9. Continue deploy-based QA on `quesiq-web` while localhost preview is
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
