# QuesIQ Platform

This repository is the one-service QuesIQ platform tree. QuesIQ Interview is
the most complete coded product in the repo today, and the platform is being
prepared to import QuesIQ Study, QuesIQ DPE, marketing, and
future product lanes without creating separate web services by default.

## Direction

- Replace the Bubble app with a codebase we own.
- Keep one primary Next.js web service and one shared Auth.js identity layer.
- Keep product code separated by product lane so Interview, Study, QuesIQ DPE,
  and marketing work can move in parallel.
- Use direct OpenAI Realtime first for browser voice practice.
- Keep VAPI as the fallback voice path.
- Keep Make for automation edges where it helps.
- Build the beta in vertical slices, starting with onboarding and practice
  setup before the live voice loop.

## Local App

The initial app scaffold is a Next.js TypeScript baseline.

Expected commands after dependencies are installed:

```powershell
npm install
npm run dev
npm run typecheck
```

Localhost preview is currently deprecated in the Codex workflow until we
intentionally fix it. Prefer deploy-based or user-confirmed QA for now.

## Render

The rebuild should deploy as its own Render web service from this repo. The
included `render.yaml` provisions Render Postgres, wires `DATABASE_URL`, and
runs the Drizzle migration before the app starts so later auth, API, database,
and voice API work can fit without changing deployment type.

## Plan

Start with `docs/rebuild/REBUILD_PLAN.md`.

See `docs/README.md` for the docs map. In short: `docs/rebuild/` is the current
source of truth, `docs/strategy/` is future planning, and `docs/reference/` is
preserved historical context.

For current platform and release guardrails, see:

- `docs/rebuild/PLATFORM_READINESS.md`
- `docs/platform/ONE_SERVICE_PLATFORM.md`
- `docs/platform/PARALLEL_DEVELOPMENT.md`
- `docs/rebuild/BRANCHING_AND_RELEASES.md`

## Data

The first app-owned data slice uses Postgres with Drizzle ORM and checked-in
Drizzle migrations.

Set `DATABASE_URL`, then run:

```powershell
npm run db:migrate
```

The practice setup flow creates a `Session` row before opening live voice.

## Auth

The first ownership slice uses Auth.js with email magic links plus Google and
GitHub OAuth. Set these server environment variables before testing sign-in and
saved practice launch:

- `AUTH_SECRET`
- `BREVO_API_KEY`
- `AUTH_EMAIL_FROM`
- `AUTH_EMAIL_FROM_NAME`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `AUTH_GITHUB_ID`
- `AUTH_GITHUB_SECRET`
- `AUTH_TRUST_HOST=true` on Render

New Session creation requires a signed-in user so later evaluation, history,
and progression records have an owner.

The app shell is locked behind sign-in. Email magic links are the primary
nontechnical user path, with Google OAuth and GitHub OAuth also available.

## Admin

Prompt configs for live Que voice sessions and post-session evaluation are
stored in Postgres and editable through the signed-in Admin tab for emails in
`ADMIN_EMAILS`.

The Admin tab also edits prompt components for practice modes, question types,
and interviewer styles. Those components are composed into the live voice prompt
and the post-session evaluation input with the user's session context.

Admin is organized into Prompts and AI Usage. AI Usage includes exact API call
usage for evaluation calls and estimated Realtime session usage based on session
duration, transcript split, model pricing, and configurable audio-token
assumptions.

Set this server environment variable before using the admin panel:

- `ADMIN_EMAILS` - comma-separated signed-in email addresses with admin access
- `REALTIME_ESTIMATED_AUDIO_INPUT_TOKENS_PER_MINUTE` - optional Realtime cost
  estimate override, defaults to `5000`
- `REALTIME_ESTIMATED_AUDIO_OUTPUT_TOKENS_PER_MINUTE` - optional Realtime cost
  estimate override, defaults to `5000`
- `PRICING_CHECK_SECRET` - optional shared secret for scheduled pricing reviews
  against `/api/pricing/review`
- `PRICING_REVIEW_MODEL` - optional model for monthly AI pricing reviews,
  defaults to `gpt-5.4-mini`

Monthly pricing reviews are scheduled through the Render Cron Job in
`render.yaml`. Set this environment variable on the cron service before relying
on the monthly run:

- `PRICING_CHECK_SECRET` - same value as the deployed web service environment

Admin can also run a pricing review manually and accept candidate changes into
new active pricing records after review.

## Practice Review

Ended voice sessions save transcript and lifecycle artifacts first, then create
an owned practice review from that saved transcript.

Before prompt config records are migrated, this optional server environment
variable provides the fallback review model:

- `OPENAI_EVALUATION_MODEL` - optional model override, defaults to `gpt-5.4-mini`

## Direct OpenAI Realtime Voice

The voice session screen opens a direct browser WebRTC session with OpenAI Realtime.

Set these server environment variables before testing it on Render or another
approved preview path. After prompt config records are migrated, model and voice
come from the active admin-managed prompt config unless the code fallback is
used.

- `OPENAI_INTERVIEW_API_KEY` - Interview text/evaluation/story/admin pricing calls
- `OPENAI_INTERVIEW_REALTIME_API_KEY` - Interview, Story Lab, and verbal Debrief Realtime voice calls
- `OPENAI_STUDY_API_KEY` - Study import, evaluation, and TTS calls
- `OPENAI_STUDY_REALTIME_API_KEY` - reserved for Study Realtime voice flows
- `OPENAI_DPE_API_KEY` - DPE review/scoring calls
- `OPENAI_DPE_REALTIME_API_KEY` - DPE Realtime oral practice calls
- `OPENAI_REALTIME_MODEL` - optional model override, defaults to `gpt-realtime`
- `OPENAI_REALTIME_VOICE` - optional voice override, defaults to `marin`

The legacy `OPENAI_API_KEY` and `OPENAI_REALTIME_API_KEY` names still work as
code fallbacks during migration, but production should use the product-specific
keys above for cleaner usage tracking and rotation.

The app keeps the API key on the server. The browser sends its WebRTC offer and
the current practice setup snapshot to `/api/realtime/session`, and the backend
exchanges that offer with OpenAI.
