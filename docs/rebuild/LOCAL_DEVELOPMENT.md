# Local Development Handoff

Last updated: 2026-06-02

## Current Local Setup

The QuesIQ manager app can now run locally on this Windows PC without deploying
to Render.

- Workspace:
  `C:\Users\weeks\Documents\github\QuesIQ-workspace\QuesIQ-manager`
- Local app URL:
  `http://127.0.0.1:3100`
- Local Postgres:
  `127.0.0.1:5433`
- Local database name:
  `quesiq_local`
- Docker Desktop:
  installed and verified on Windows x64 with WSL2
- Local env file:
  `.env.local` exists locally and is ignored by git

## Files Added For Local Development

- `docker-compose.yml`: starts local Postgres in Docker.
- `.env.local.example`: committed local env template.
- `.env.local`: private local env file, ignored by git.
- `scripts/local-docker-compose.ps1`: wrapper that adds Docker Desktop's CLI
  path for this Windows session.
- `package.json`: local commands were added.

## Commands

Run these from:

```powershell
C:\Users\weeks\Documents\github\QuesIQ-workspace\QuesIQ-manager
```

Start local Postgres:

```powershell
npm run db:local:up
```

Apply migrations to local Postgres:

```powershell
npm run db:local:migrate
```

Start the local web app:

```powershell
npm run dev:local
```

Open:

```text
http://127.0.0.1:3100
```

## Admin Prompt Test Tunnel

The backend text-clone path for Interview QA is the Admin Prompt Test Tunnel.
It is an admin-only typed-turn simulator for testing server-side prompt/runtime
behavior after a transcript would normally exist. It is not a public backdoor
and must stay behind admin authentication.

Local requirements:

- `DATABASE_URL` points at local Postgres.
- `ADMIN_EMAILS` includes the signed-in local admin email.
- `OPENAI_INTERVIEW_TEST_TUNNEL_API_KEY` is set in `.env.local`.
  Existing fallback order is
  `OPENAI_INTERVIEW_REALTIME_API_KEY`, `OPENAI_INTERVIEW_API_KEY`,
  `OPENAI_REALTIME_API_KEY`, then `OPENAI_API_KEY`, but the dedicated
  test-tunnel key is preferred for usage tracking.
- Local migrations are applied with `npm run db:local:migrate`.

Local path:

```text
http://127.0.0.1:3100/admin
```

Open the legacy Interview Admin panel, then `Prompt Test Tunnel`. The panel
shows backend readiness for the current server before creating a test session.
For Coaching QA, create a Coaching session, submit typed candidate answers, and
use the More feedback, Try again, and Move on controls to test explicit choice
routing without microphone hardware.

For standard backend prompt/runtime smoke before deploy, run:

```powershell
npm run smoke:interview-turns
```

This uses local Postgres, disposable local session rows, the same backend
turn-based engine used by the Admin Prompt Test Tunnel, and
`OPENAI_INTERVIEW_TEST_TUNNEL_API_KEY` or an accepted fallback key. It covers
Rapid Fire, Intro Practice, and Story Practice/TMAAT without adding a Render
backdoor endpoint.

## Hands-Free Coaching QA

Hands-Free Coaching is a separate premium-labeled realtime voice mode. It is
not part of the button-driven Coaching, Question Queue, Rapid Fire, Intro
Practice, or TMAAT flows.

Local learner visibility is controlled by:

```powershell
INTERVIEW_HANDS_FREE_COACHING_ENABLED=true
```

When the flag is absent or false, admin users can still see and launch
Hands-Free Coaching for QA. Normal learners should not see it in the catalog and
server launch routes should reject direct attempts. The session uses the
`realtime_hands_free_coach` prompt config, the `hands_free_coaching` runtime
config, and a 900-second session cap.

Hands-Free Coaching realtime context should include:

- cleaned mode instructions;
- active `realtime_hands_free_coach` prompt;
- `resume_summary` output generated immediately after resume upload when a
  parsed resume exists;
- target role/company plus a capped job description excerpt;
- coaching memory;
- relevance-ranked saved story library context.

It should not switch to `story_practice_realtime`. If structured resume summary
generation is unavailable, the route may fall back to a capped raw resume
excerpt and records the unavailable reason in `ai_runs.raw_json`.

Stop local Postgres:

```powershell
npm run db:local:down
```

## Verified On 2026-06-02

- Docker Desktop launched successfully.
- `postgres:17-alpine` was pulled.
- Local Postgres container `quesiq-local-postgres` started healthy.
- All 62 Drizzle migrations applied successfully through
  `0062_add_account_password_credentials`.
- `npm run typecheck` passed.
- `npm run dev:local` started Next.js on `127.0.0.1:3100`.
- The local app returned HTTP 200.
- In-app browser loaded the app with title:
  `QuesIQ | AI Practice Platform`.

## Known Limits

- AI voice, email magic links, R2-backed storage, and product-specific OpenAI
  flows still need real local secrets in `.env.local`.
- This local setup is for development and QA only. Do not point it at the
  production Render database unless explicitly doing a read/export operation.
- Render remains useful later for staging, OAuth callback QA, public mobile
  testing, and production-like environment checks.

## Manager Chat Guidance

Prefer this local path for day-to-day development QA before deploying:

1. Confirm Docker Desktop is running.
2. Run `npm run db:local:up`.
3. Run `npm run db:local:migrate` after schema changes or first setup.
4. Run `npm run dev:local`.
5. Test at `http://127.0.0.1:3100`.

Do not retry old `localhost:3000` workflows by default. The current local
standard is `127.0.0.1:3100` plus Docker Postgres on `127.0.0.1:5433`.
