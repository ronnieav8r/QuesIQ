# QuesIQ Interview

This repository is the custom coded rebuild of QuesIQ Interview.

## Direction

- Replace the Bubble app with a codebase we own.
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

Set this server environment variable before using the admin panel:

- `ADMIN_EMAILS` - comma-separated signed-in email addresses with admin access

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

- `OPENAI_API_KEY` - required server-side OpenAI API key
- `OPENAI_REALTIME_MODEL` - optional model override, defaults to `gpt-realtime`
- `OPENAI_REALTIME_VOICE` - optional voice override, defaults to `marin`

The app keeps the API key on the server. The browser sends its WebRTC offer and
the current practice setup snapshot to `/api/realtime/session`, and the backend
exchanges that offer with OpenAI.
