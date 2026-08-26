# Interview Local Regression System

Last updated: 2026-08-26

This is the canonical local test guide for QuesIQ Interview. The gate is
Interview-only; Study, DPE, NCLEX, Quira, Render, and production traffic are
outside its scope.

## Command Family

Run from:

```powershell
E:\Codex\QuesIQ\QuesIQ App Worktrees\QuesIQ-dev
```

```powershell
npm run test:interview:static
npm run test:interview:services
npm run test:interview:e2e
npm run test:interview:live-ai
npm run test:interview:all
```

- `test:interview:static` runs Interview readiness, TypeScript, and ESLint.
- `test:interview:services` seeds deterministic local Interview records and
  verifies database persistence.
- `test:interview:e2e` starts an isolated Next development server and runs the
  desktop Chromium and Pixel-sized mobile browser matrix.
- `test:interview:live-ai` exercises the real turn-based Interview model path.
  It is opt-in and separate from the deterministic default gate.
- `test:interview:all` runs static, service, and E2E checks in sequence.

## Required Local State

- Node and npm versions satisfy `package.json`.
- Dependencies are installed from `package-lock.json`.
- Docker Postgres is healthy on the `.env.local` `DATABASE_URL`.
- Local migrations are current.
- Playwright Chromium is installed.

Typical setup:

```powershell
npm ci
npm run playwright:install
npm run db:local:up
npm run db:local:migrate
npm run test:interview:all
```

## Isolated Browser Server

The Playwright configuration is `playwright.interview.config.ts`. It uses:

- default URL `http://127.0.0.1:3210`
- override variable `INTERVIEW_E2E_PORT`
- Next output directory `.next-interview-e2e`
- `E2E_TEST_MODE=1`
- `DEV_AUTH_BYPASS_ENABLED=1`
- `E2E_AI_MODE=mock` by default

The wrappers are:

```text
scripts/test/interview-e2e-runner.mjs
scripts/test/interview-e2e-server.mjs
```

They restore Next-generated `next-env.d.ts` and `tsconfig.json` changes after a
normal test run. If a run is interrupted, confirm those files are clean before
committing.

## Seeded Test Data

The seed and service harness is:

```text
scripts/test/interview-regression.ts
scripts/test/interview-services.ts
tests/interview/global-setup.ts
```

Disposable rows use the prefix:

```text
[TEST_DELETE] Interview Regression
```

The seed creates one local E2E admin user plus Interview-owned records for:

- a job target
- a custom Question Queue question
- a saved story
- a saved introduction
- a deterministic Rapid Fire session

Cleanup is scoped to the seeded E2E user and Interview-owned tables.

## Browser Coverage

The browser specification is:

```text
tests/interview/interview-regression.spec.ts
```

It verifies:

- authenticated Interview shell navigation
- Coaching, Rapid Fire, Mock Interview, and Hands-Free setup cards
- Story Lab, History, and Me rendering
- profile/job-target, Question Queue, story, and introduction APIs
- custom question create, update, and delete
- admin Interview test-tunnel readiness
- desktop and mobile layouts
- no unexpected browser console or failed-response errors

AI-adjacent browser behavior is mocked by default. The E2E gate does not spend
API credits or claim to verify real microphone, speaker, or Realtime quality.

## Live AI Smoke

Run only when an accepted local key is intentionally configured:

```powershell
npm run test:interview:live-ai
```

Accepted keys are `OPENAI_INTERVIEW_TEST_TUNNEL_API_KEY`,
`OPENAI_INTERVIEW_API_KEY`, or `OPENAI_API_KEY`. The smoke uses disposable
local rows and the existing turn-based Interview backend. It does not deploy or
write to Render.

## Artifacts

Generated outputs are ignored by git and live under:

```text
artifacts/interview-regression/
```

Key outputs include `seed-state.json`, `service-summary.json`, `run-report.md`,
Playwright results, screenshots, traces, videos, and the HTML report.

## Troubleshooting

If the browser server returns unexpected 404s or module-resolution errors:

1. Stop any stale local test server on port 3210.
2. Confirm `npm ls pg @aws-sdk/client-s3 --depth=0` succeeds.
3. Rebuild dependencies with `npm ci` if the install is invalid.
4. Move the ignored `.next-interview-e2e` cache aside and rerun.
5. Confirm `next-env.d.ts` and `tsconfig.json` did not retain generated paths.

If service checks fail:

```powershell
npm run db:local:up
npm run db:local:migrate
npm run test:interview:services
```

If Playwright Chromium is missing:

```powershell
npm run playwright:install
```

## Manual QA Boundary

Automation does not validate real microphone permission prompts, microphone
selection, headset behavior, audio clipping, speaker quality, or genuine
Realtime conversation quality. Verify those manually in the visible local app
at `http://127.0.0.1:3100` after the automated gate is green.
