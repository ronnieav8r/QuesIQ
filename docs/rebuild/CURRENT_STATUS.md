# Current Status

Last updated: 2026-05-30

## Rebuild Location

- Manager clone:
  `C:\Users\weeks\Documents\github\QuesIQ-workspace\QuesIQ-manager`
- GitHub repo: `ronnieav8r/QuesIQ`
- Living rebuild docs: `docs/rebuild/`
- Docs map: `docs/README.md`
- Parallel worker clones:
  - Interview:
    `C:\Users\weeks\Documents\github\QuesIQ-workspace\QuesIQ-interview` on
    `codex/interview`
  - Study:
    `C:\Users\weeks\Documents\github\QuesIQ-workspace\QuesIQ-study` on
    `codex/study`
  - DPE: `C:\Users\weeks\Documents\github\QuesIQ-workspace\QuesIQ-dpe` on
    `codex/dpe`
  - Admin:
    `C:\Users\weeks\Documents\github\QuesIQ-workspace\QuesIQ-admin` on
    `codex/admin`
- The older local checkout `C:\Users\weeks\Documents\github\QuesIQ` is
  reference/archive unless a manager explicitly reactivates it.
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
- User is not expecting to manually review code for correctness. Future Codex
  passes should own verification, explain outcomes plainly, and when requested
  prepare the GitHub push/deploy path instead of leaving that work to the user.
- Latest integration pass: `1c42658 Add admin DPE progression visibility`.
  `QuesIQ-manager/main` is clean and aligned with `origin/main` at that commit.

## Built So Far

- Public marketing homepage regeneration:
  - `/` now renders a QuesIQ platform marketing homepage instead of the signed-in
    platform product picker
  - new homepage file:
    `src/features/marketing/marketing-home.tsx`
  - homepage sections include brand nav, hero CTA, dashboard-style product
    preview, Interview/Study/DPE product cards, how-it-works, trust grid,
    proof stats, and footer product links
  - CTAs route into the shared login flow with product-aware `next` paths
  - app metadata now describes the broader QuesIQ AI practice platform instead
    of only QuesIQ Interview
- Shared platform login/account gateway:
  - `/login` supports product-aware redirects such as `?next=/interview`,
    `?next=/study`, and `?next=/dpe`
  - `/account` now acts as a product hub for the shared Auth.js account
  - shared product definitions live in `src/features/platform/products.ts`
- QuesIQ DPE import:
  - DPE lives as its own product lane under `/dpe`
  - DPE APIs live under `/api/dpe/*`
  - DPE-owned data uses `dpe_*` tables in the same shared Postgres database and
    shared Auth.js user id boundary
  - baseline DPE content/session/profile/review tables were added in migration
    `0050_add_dpe_baseline_tables.sql`
  - baseline Private Pilot ASEL placeholder content is seeded in the migration
  - DPE voice uses the existing direct OpenAI Realtime pattern; assume it works
    until the user resumes voice troubleshooting
  - DPE MVP-readiness scaffolding now supports Private Pilot ASEL plus
    Instrument Airplane, Commercial Airplane Land, CFI Airplane, CFII Airplane,
    Multi-Engine Land, and MEI Airplane as selectable target tracks using
    existing checkride target fields
  - DPE Home/Practice/Me treat no-content tracks as intentional scaffolding
    instead of app failure; users can keep a selected target track while using
    available demo/private-pilot content until real content is authored
  - DPE now has product-owned persistent progression tables in migration
    `0053_add_dpe_progression.sql`, XP rule/quest defaults, `GET
    /api/dpe/progression`, and award hooks on completed DPE sessions, saved
    voice artifacts, and readiness reviews
  - DPE learner polish now includes a Home MVP readiness checklist, clearer
    scaffolded-track/demo-content practice messaging, and History review
    selection for reopening a specific stored session review
  - Real DPE aviation content remains intentionally untouched for a later
    user-guided content curation pass
- Shared Admin Content Studio:
  - Admin owns shared Content Studio UI/API work under the protected `/admin`
    console
  - `/admin?product=content` supports source intake, pipeline/template
    selection, custom instructions, Study and DPE draft generation,
    saved-run review display, and durable reviewer notes/status
  - Content Studio now includes a read-only scaffold for source-pack figure and
    table visual review. It models figures.jsonl/tables.jsonl candidates,
    status badges, page/caption/topic metadata, source/chunk excerpts,
    keep/review/skip recommendations, and preview asset placeholders without
    reading local source-pack folders, calling Drive, or writing publish state.
  - `/api/admin/content-studio/runs` orchestrates Study draft generation and
    DPE content draft generation, then creates durable run records in
    `content_studio_runs`
  - `GET/PATCH /api/admin/content-studio/runs/[runId]` reopens saved draft
    payloads and persists reviewer notes/status changes for Admin review
  - Content Studio runs store source snapshots, source metadata, template key,
    draft JSON, confidence, warnings, missing fields, reviewer
    checklist/summary, admin user, timestamps, and optional `ai_runs` links
  - Study draft generation is product-owned at
    `/api/study/content-studio/flashcard-draft` and returns review-ready deck
    metadata, cards, confidence, warnings, missing fields, and checklist flags
  - DPE draft generation is product-owned at `/api/dpe/content/draft` and
    returns certificate, ACS, oral-question, answer-key, rubric, confidence,
    warning, readiness, and missing-field draft JSON without saving live content
  - Admin Content Studio and DPE Admin readiness views now carry/display DPE
    target-track context for the requested MVP tracks without publishing or
    writing product content
  - Admin has read-only DPE progression visibility through
    `/api/admin/dpe-progression` and the Admin DPE panel: progression user
    summaries, recent events, quest definitions, and XP rule definitions
  - Publish, Official, and Verified changes remain disabled until
    product-specific publish controls exist; `approved_for_publish` is only an
    internal review status and does not write product tables
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
  - practice mode prompt instructions are now differentiated for First
    Impression, Coaching, Rapid Fire, and Mock Interview behavior
  - question type prompt instructions are now differentiated for Behavioral,
    Technical, Hypothetical, and Motivational practice
  - interviewer style prompt instructions are now differentiated for Friendly,
    Neutral, and Tough practice
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
  - Story Lab follow-up, Story Lab outline, Introduction Draft, and legacy
    written Debrief Responses API calls now create AI run records with prompt
    config, run type, user/session context when available, provider response id,
    status, token usage, and estimated cost when usage is returned
  - Realtime exchange endpoints for practice sessions, Story Lab capture, and
    verbal Debrief now create AI run rows for setup success/failure; app-owned
    practice sessions still save fuller Realtime usage after the voice artifact
    is persisted
  - AI run records now retain prompt config id, prompt config key/version,
    prompt instruction snapshot, and safe raw JSON metadata; Admin AI Usage
    shows a Prompt column that can open the matching prompt config version
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
- Admin Diagnostics visibility:
  - client-side diagnostics capture failed same-origin `/api/*` calls, rejected
    fetches, uncaught browser errors, and unhandled promise rejections
  - Realtime voice sessions log connection failures, invalid data-channel
    messages, and `client.session.error` events with session/screen context
  - Admin now has a Diagnostics tab showing recent sanitized events with
    severity, source, endpoint, status, duration, user, session, message, and
    metadata
- First global beta feedback slice:
  - signed-in users can open a Feedback button from any screen
  - the lightweight dialog supports bug or feedback, 1-5 rating, and an
    optional short note
  - users can attach an optional screenshot for bug/feedback reports during the
    beta while object storage is not yet in place
  - the rating prompt is shown above the stars so each submission preserves what
    the user was asked to rate
  - a one-time popup now appears when a newly completed practice review is ready
    and rotates specific beta questions about review usefulness, voice realism,
    transcript accuracy, and scoring fairness
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
  - shared Realtime audio input config uses near-field noise reduction,
    stricter server VAD, longer silence detection, and disabled automatic
    response interruption to reduce false interruptions from headset/cable noise
  - OpenAI calls now prefer product-specific keys for usage tracking:
    `OPENAI_INTERVIEW_API_KEY`, `OPENAI_INTERVIEW_REALTIME_API_KEY`,
    `OPENAI_STUDY_API_KEY`, `OPENAI_STUDY_REALTIME_API_KEY`,
    `OPENAI_DPE_API_KEY`, and `OPENAI_DPE_REALTIME_API_KEY`; legacy shared
    `OPENAI_API_KEY` and `OPENAI_REALTIME_API_KEY` names remain code fallbacks
    during migration.
  - Realtime Interviewer prompt v4 and the client first-turn templates now
    specify a realistic interview opening, instruction hierarchy,
    mode/question/style composition, concise turn-taking, no setup narration,
    and no mid-answer interruption
  - Regular practice first-turn mode behavior now lives in the Admin-visible
    Realtime Interviewer prompt; the client sends only a minimal kickoff that
    tells the model to start using the active Admin prompt and runtime context
  - Story Lab Introduction/TMAAT capture and verbal Debrief first-turn behavior
    now live in Admin-visible prompt configs; client/server code passes capture
    purpose and saved session context instead of behavior instructions
  - End Session now stops the mic, commits pending audio for transcription,
    waits briefly for transcript completion, and finalizes the artifact without
    asking Que for another response; if Que is already speaking, End cancels
    the active response
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
- Saved Job Targets:
  - Me now separates the user's Profile from Job Targets: name/resume stay in
    Profile, while reusable targets hold role, company, label, and job
    description/notes
  - signed-in users can add, edit, and delete reusable Job Targets from Me
  - active target preference is saved on the user's Profile, so Home, Practice,
    and future sessions agree on the current opportunity
  - Practice setup lets users choose the profile target or a saved Job Target
    before selecting mode/style
  - launched Sessions store the selected target id in the setup snapshot and
    mark that target as recently used
  - Home's Me & Targets panel and Recommended Next can route users into the
    clearer profile/target management screen, with target-aware nudges for
    choosing an active target, adding target notes, or starting a first practice
    for the active opportunity
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
  - Home progression now separates Level/XP from streak, with a flame icon for
    the streak stat
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
- Story Lab Phase 1 started:
  - the former Stories placeholder is now positioned as Story Lab
  - users can now choose Tell Que, Dictate, or Type as story-capture modes:
    Tell Que opens a Realtime story conversation, Dictate uses browser speech
    recognition for uninterrupted capture, and Type is the text fallback
  - Que can generate one follow-up question from the raw story-building turns
  - Que can generate and save a reusable STARR-style story outline with title,
    summary, situation, task, actions, result, categories, alternate spins,
    coach notes, and a practice prompt
  - saved story outlines are stored in Postgres and listed in Story Lab
- Story Lab Phase 2 library polish started:
  - saved story cards can be selected into a detail panel
  - saved outlines can be edited after generation, including title, summary,
    STARR fields, action bullets, coach notes, raw notes, practice prompt, and
    categories
  - saved TMAAT stories can be deleted from the card or detail view without
    deleting historical practice sessions
  - story updates are owner-scoped through a protected `/api/stories/[storyId]`
    route
- Story Lab Phase 3 practice hook started:
  - story cards open by tapping the card itself, with one explicit Edit Story
    action
  - saved story details include a Practice Story action
  - Practice Story creates an owned voice Session with the saved story outline
    carried in the session snapshot
  - Realtime Que instructions use the saved story context to ask a fitting
    behavioral practice question without reading the outline back to the user
  - post-session evaluation receives the saved story context and is instructed
    to give story-specific feedback
  - Story Practice reviews now persist compact coaching history back onto the
    Story record, including last-practiced date, practice count, and recent
    coaching summaries
  - normal practice and evaluation calls now receive compact saved-story library
    context so Que can suggest a better-fit saved story when appropriate
- Story Lab introduction builder started:
  - Story Lab now has separate TMAAT and Introduction tabs
  - TMAAT keeps the existing Tell Que, Dictate, Type, saved story library, edit,
    and Practice Story flow
  - the tab selector now puts Introduction first and uses dedicated centered
    layout styles so the Introduction/TMAAT choices are centered inside the
    group instead of inheriting the generic segmented-control grid behavior
  - Introduction Builder now starts with Talk with Que, Dictate, or Type entry
    points and timing guidance; raw context fields are not shown up front
  - Talk with Que uses a transcript-style live conversation surface, while
    Dictate and Type use a simple notes/script entry surface
  - saved introductions hold the durable detail fields: background, strength,
    proof point, role interest, closing handoff, practice count, and recent
    practice coaching
  - Story Lab now has a local Build/Library split so the Introduction and TMAAT
    capture screens stay focused while saved intros/stories remain one tap away
  - switching between Introduction and TMAAT resets draft/transcript capture
    state so material from the previous tab does not leak into the next one
  - users can save multiple introductions and launch a focused Intro Practice
    session from a saved introduction
  - Intro timing guidance uses Short, Medium, and Long ranges with notes about
    likely use cases instead of a separate interview-setting chooser
  - Intro Practice carries the saved intro into Que's Realtime context and stores
    review coaching back on the introduction after evaluation; short intro
    practice sessions can score after a lower minimum duration
  - progression quests now include first saved Introduction and first saved TMAAT
    Story checks, and Home's Recommended Next can route users to Story Lab when
    no saved introduction exists
  - Introduction Builder now has an AI draft/extraction slice: captured Talk
    with Que transcripts, dictated notes, or typed notes can produce a polished
    script plus background, core strength, proof point, role interest, and
    closing handoff before save
  - Introduction Draft is now guarded against low-signal test/filler material
    and its active prompt is stricter about extracting only user-provided facts
    instead of inventing details from target role/company context
- Story Lab prompts are now Admin-visible:
  - Story Conversation Realtime, Story Lab follow-up, story outline generation,
    Introduction Draft, Story Practice Realtime guidance, and Story Practice
    Evaluation guidance are versioned prompt configs alongside the existing
    Realtime interviewer and session evaluation prompts
  - Admin > Prompts > Base can view, draft, and activate these prompts
- Mobile chrome was tightened:
  - removed the app-header readiness line
  - removed signed-in account name from the header action area
  - reduced header height while keeping brand and sign-out available
- Navigation shell update:
  - Story Lab is now a primary navigation destination instead of only living
    behind Me
  - the mobile bottom nav can be collapsed by the user into a small Menu handle
    and expanded again with a chevron
  - the collapsed/expanded nav preference is remembered locally
  - desktop keeps the persistent left navigation rail
- Installable app baseline:
  - QuesIQ now publishes a web app manifest using the existing brand icon,
    standalone display mode, app colors, and root start URL so supported mobile
    browsers can add it to the home screen without browser chrome
- Debrief mode pivot:
  - written debrief generation was deprecated because it duplicated the saved
    practice review
  - Debrief now means a Realtime voice conversation tied to an existing
    transcript-backed session
  - the Session Debrief prompt remains in Admin > Prompts for viewing, drafting,
    and activation, but it now drives the verbal debrief assistant
  - debrief-count quests and saved debrief records are legacy until voice
    debrief persistence is deliberately added
- Post-session review prompt refinement started:
  - the Bubble reference confirmed the five locked dimensions and role-relative
    scoring guardrails: Confidence, Clarity, Relevance, Impact, and
    Authenticity
  - the coded app now keeps the strict return contract in the OpenAI structured
    response schema, while Admin > Prompts controls the editable instruction
    layer
  - new reviews include richer review-detail sections in the same evaluation
    call, so written debrief guidance does not duplicate the saved review
  - migration `0028_refine_session_evaluation_prompt.sql` activates the richer
    Session Evaluation prompt version
- Verbal Debrief interface started:
  - the old written debrief composer/list screen has been removed from the user
    flow
  - History cards now launch Debrief for transcript-backed sessions
  - expanded saved reviews include a Start Debrief button near the bottom
  - the voice debrief uses a dedicated Realtime endpoint with the saved
    transcript, written review, review detail, score evidence, and coaching
    memory as context
  - voice debriefs save a transcript/event artifact in `voice_debriefs` after
    the call ends without creating a new scored practice session or written
    debrief record
- Admin navigation moved out of Me and into the hamburger menu while staying
  visible only to admins.
- Coaching memory started:
  - QuesIQ stores one compact coaching memory row per user
  - post-session evaluation receives prior memory and returns the updated
    memory in the same AI call as the review
  - memory tracks a concise summary, strengths, growth areas, recurring
    patterns, latest recommendation, and evidence count
  - Home shows a "What Que Is Learning" panel after memory exists
  - Realtime voice sessions and Debriefs receive saved memory as quiet coaching
    context
  - Admin > Prompts includes updated Session Evaluation and Session Debrief
    prompt versions that describe the memory behavior
- Richer Up Next logic started:
  - Home now uses a deterministic recommendation waterfall instead of only
    pending-review/weak-score/default logic
  - priority order currently covers pending reviews, missing core context,
    missing parsed resume, debriefing the latest reviewed session, weakest
    score practice, Story Lab, near-complete quests, and default practice
  - the primary recommendation button routes directly to review retry,
    onboarding, debrief, Story Lab, or practice depending on the selected nudge
- XP/reward refinement started:
  - Admin > Progression now includes editable XP Rules
  - review XP is awarded by rule rows instead of a single hardcoded flat reward
  - default review rewards are intentionally less completion-heavy: small base
    completion XP, highest-only duration tiers, highest-only overall-score
    tiers, and a small first-practice-today bonus
  - resume upload rewards are rule-driven; Debrief completion rules now award
    from saved verbal Debrief artifacts, while legacy written debrief rows still
    count for old/demo data
  - Admin XP Events now expose event metadata so individual rule awards can be
    inspected
- Admin demo data seeding started:
  - Admin > Data includes a "Seed Ronnie Demo Data" button
  - the seed targets a user whose email/name/id contains `ronnieav8r`, falling
    back to the current admin user
  - it creates representative rows for empty/missing profile, story,
    introduction, session, evaluation, legacy debrief, coaching memory,
    feedback, and progression data
- QuesIQ Study import advanced as a separate product lane under `/study`:
  - Study routes and APIs live under `/study` and `/api/study`, with code in
    `src/features/study/` and Study-owned `study_*` tables
  - source-style deck-page picker routing, level filters, SRS/resume handling,
    verbal/quiz hands-free paths, speech recognition, Study TTS, and AI Usage
    instrumentation are in code
  - AI-assisted deck import supports PDF, image, pasted text, and URLs through
    `/api/study/decks/[deckId]/import`, with Study import/evaluation/TTS calls
    represented in `ai_runs`
  - folder APIs, deck folder assignment, inline public/private toggle,
    private owner-only export, deck stats/card-attempt detail, and inline card
    edit/delete polish are in code
  - Study library has public deck search/filtering, deliberate scope filters
    (`all`, `official`, `mine`), Study-prefixed taxonomy tables, mapped
    audience-tag filtering, and test seed/cleanup SQL under `scripts/study/`
  - Study now has its first product-owned XP/quest slice in migration
    `0052_add_study_progression.sql`: Study-prefixed progression events, XP
    rules, quests, user progression summaries, user quest state, XP awards from
    card ratings, and a Study dashboard momentum panel

## Verification

The current coded app has passed:

- Latest marketing homepage regeneration passed `npm run typecheck`,
  `npm run lint`, and `npm run build` on 2026-05-29. Local headless browser
  screenshot QA could not be completed because Chrome and Edge failed with a GPU
  runtime error before writing a screenshot.
- Latest DPE import/shared login work passed `npm run typecheck`,
  `npm run lint`, and `npm run build` before the marketing homepage pass.
- ESLint
- TypeScript check
- Latest local feedback/progression/UI foundation/user-screen cleanup/Quira
  baseline checks passed with ESLint, TypeScript, and production build.
- Next production build
- Latest local review/debrief prompt work passed ESLint, TypeScript check, and
  production build. Build output includes the new `/api/realtime/debrief`
  route.
- Latest local checks passed with local `npm` available on PATH.
- Latest Study import/taxonomy local checks passed on 2026-05-29 with ESLint,
  TypeScript check, and production build.
- Story Lab Phase 1, Phase 2, and Phase 3 practice-hook local checks passed:
  ESLint, TypeScript, and production build.
- Latest Story Lab Introduction/TMAAT cleanup passed ESLint, TypeScript check,
  and production build on 2026-05-28.
- Introduction Builder draft/extraction slice passed ESLint and TypeScript check
  on 2026-05-28.
- Rotating beta feedback prompts passed ESLint and TypeScript check on
  2026-05-28.
- Admin Diagnostics event logging slice passed ESLint and TypeScript check on
  2026-05-28.
- AI usage instrumentation audit for Story Lab, Introduction Builder, Realtime
  exchange endpoints, and legacy written Debrief passed ESLint and TypeScript
  check on 2026-05-28.
- AI run prompt link/snapshot/raw JSON metadata pass passed ESLint and
  TypeScript check on 2026-05-28.
- Saved Job Targets edit/delete/active-target and target-aware Up Next polish
  passed ESLint and TypeScript check on 2026-05-28.
- TMAAT story deletion and installable app manifest baseline passed ESLint and
  TypeScript check on 2026-05-28.
- Introduction Draft hallucination guard and interviewer-style intro capture
  prompt pass passed ESLint and TypeScript check on 2026-05-28.
- Realtime headset-noise/false-interruption tuning passed ESLint and TypeScript
  check on 2026-05-28.
- Story Lab Build/Library split, mobile tab cleanup, TMAAT STAR detail order,
  and patient TMAAT capture tuning passed ESLint, TypeScript check, and
  production build on 2026-05-28.
- Dedicated Realtime voice API key routing passed ESLint, TypeScript check, and
  production build on 2026-05-28.
- Realtime Interviewer v2 prompt and first-turn template refinement passed
  ESLint, TypeScript check, and production build on 2026-05-28.
- Admin prompt visibility cleanup for regular practice first-turn behavior
  passed ESLint, TypeScript check, and production build on 2026-05-28.
- Realtime End Session transcript-drain fix passed ESLint, TypeScript check,
  and production build on 2026-05-28.
- Story Lab/Debrief prompt visibility migration passed ESLint, TypeScript
  check, and production build on 2026-05-28.
- Practice mode prompt refinement passed ESLint, TypeScript check, and
  production build on 2026-05-28.
- Question type prompt refinement passed ESLint, TypeScript check, and
  production build on 2026-05-28.
- Interviewer style prompt refinement passed ESLint, TypeScript check, and
  production build on 2026-05-28.
- Realtime Interviewer base prompt v4 refinement passed ESLint, TypeScript
  check, and production build on 2026-05-28.
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

Legacy written-debrief backend pieces still exist (`/api/debriefs` and the
`debriefs` table), but the active user flow is verbal Debrief through
`/api/realtime/debrief`. New verbal Debrief artifacts persist in
`voice_debriefs`; saved written debrief data is legacy/demo/reference.

## Current Product Direction

- Replace Bubble for the core QuesIQ Interview app.
- Keep QuesIQ Interview as the lead coded product. QuesIQ Study is now being
  imported as a separate product lane inside the same service. Shared billing,
  cross-product account dashboards, a shared platform shell, and shared
  product-level Quira service boundaries remain later platform work.
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
- Keep design tokens and reusable UI patterns clean enough to extract later, but
  do not create a separate design-system package until there is a second active
  product that needs it.
- Preserve Auth.js identity as the generic user/account root. Keep
  Interview-specific profile, session, story, job-target, progression, feedback,
  and coaching-memory data in product tables keyed by `user_id`.
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

1. Deploy and user-confirm QA the new marketing homepage at `quesiq.com`,
   especially desktop/mobile visual spacing, CTA routing to `/login?next=...`,
   and product card links for Interview, Study, and DPE.
2. Deploy and verify DPE migration `0050_add_dpe_baseline_tables.sql` actually
   runs in Render logs, then confirm the previous production errors for missing
   `dpe_certificate_types`, `dpe_oral_questions`, and
   `dpe_practice_sessions` are gone.
3. Deploy and user-confirm QA the latest Story Lab, prompt, debrief,
   progression, and job-target UI changes on `quesiq-web`, making sure
   migrations through `0048_add_study_library_taxonomy.sql` run before using
   the updated Story Lab or Study library taxonomy paths in production.
4. Run/user-confirm Study library taxonomy QA: after migrations through `0048`,
   run `scripts/study/seed_test_decks.sql`, confirm `/study/library` filters by
   subject, text tag, and mapped audience tags, then run
   `scripts/study/cleanup_test_decks.sql`.
5. Run/user-confirm migration QA for Bubble levels and quests: Admin >
   Progression > Levels shows Rookie through Master, Admin > Progression >
   Quests shows 37 active definitions, Admin level/quest edits save, and Home
   awards quest XP once per quest.
6. Add/confirm `ADMIN_EMAILS` in Render before QAing Admin; monthly pricing
   checks are suspended/deprecated, so `PRICING_CHECK_SECRET` is not an active
   QA blocker unless manual pricing-review endpoint testing resumes.
7. Keep pricing updates manual until candidate preview/writeback or a
   deterministic pricing parser is built.
8. Deploy/user-confirm progression QA: existing reviewed sessions backfill XP,
   new completed reviews award XP once, Home shows saved streak/level/latest
   next action, level thresholds load from Admin, and retry/reopen does not
   double-count.
9. QA scoring polish: Recent Scores uses the latest 10 reviews, Skill Scores is
   all-time, Overall is highlighted, and sub-120-second sessions appear in
   History without scoring or XP.
10. QA rotating post-review beta feedback prompts in production and confirm Admin
   Feedback stores the exact `rating_prompt` for review usefulness, voice
   realism, transcript accuracy, and scoring fairness.
11. QA Admin Diagnostics in production: trigger or observe a failed API response
   and a Realtime connection issue, then confirm the Diagnostics tab shows
   sanitized event rows without secrets, raw audio, or large transcripts.
12. QA the Introduction Builder AI draft/extraction flow in production: after
   Talk with Que transcript capture, verify `/api/introductions/draft` runs,
   fills the structured intro fields, and saves the polished intro with raw
   notes retained.
13. QA the Story Lab Talk with Que entry points in production, especially any
   `client.session.error` behavior on the Introduction conversation endpoint.
14. QA installable app behavior on iOS and Android: add QuesIQ to the home
   screen, launch it, and confirm standalone mode uses the expected icon,
   splash/background color, and app start URL.
15. Consider mobile bottom-nav auto-hide later as a guarded UX experiment:
   visible by default, hide only on meaningful downward scroll, show
   immediately on upward scroll, and never hide during active voice/session,
   error, modal, save, or onboarding states.
16. Later Quira work: replace the curated Help panel with an AI chat bot backed
   by a maintained QuesIQ product knowledge base.
17. Product gap backlog from the Bubble reference, ordered by current user value:
   richer coaching memory controls, tuning XP rules from beta behavior, and
   AI-backed Quira support.
18. Treat standalone anonymous bug reports, in-app marketing/blog pages,
   payments, industry packs, mascot work, and VAPI parity as lower-priority
   until the core practice loop and retention features are stronger.
19. Continue deploy-based QA on `quesiq-web` while localhost preview is
   deprecated until we intentionally fix it.
20. Before broader live traffic, establish the documented branch/release flow:
   scoped `codex/*` work branches, `main` as stable integration, and `live` as
   the exact production branch after the current production commit is confirmed.

## Reference Inputs

- Bubble/Claude handoff:
  `C:\Users\weeks\OneDrive\Documents\QuesIQ\claude_handoffs\interview_prep_app_project_state (4).md`
- Living rebuild docs in this repo:
  `docs/rebuild/REBUILD_PLAN.md`
  `docs/rebuild/ARCHITECTURE.md`
  `docs/rebuild/PRODUCT_SCOPE.md`
  `docs/rebuild/DECISIONS.md`
  `docs/rebuild/HANDOFF.md`
  `docs/rebuild/PLATFORM_READINESS.md`
  `docs/rebuild/BRANCHING_AND_RELEASES.md`
