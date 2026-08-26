# Interview + Study Regression System

Last updated: 2026-06-21

This is the canonical local regression guide for QuesIQ Interview and QuesIQ
Study. It documents the automated testability system that verifies the current
functional paths for these two product lanes without touching DPE, NCLEX,
Quira-specific behavior, or production data.

Use this file when you need to run the gate, understand what it covers, repair
the harness, or rebuild the same approach in another checkout.

## What This System Is

The Interview + Study regression system is a local-first test gate made of four
layers:

1. Static readiness checks for Interview and Study.
2. TypeScript and lint checks.
3. DB-backed service checks using deterministic seeded data.
4. Playwright browser automation on desktop Chromium and Pixel-sized mobile.

There is also an explicit live-AI smoke command. The normal regression gate uses
mocked AI behavior for browser tests so it can run without OpenAI or R2 secrets.
The live-AI smoke is separate and only runs real model paths when a valid
OpenAI-style test key is present.

## Commands

Run these from the app worktree root:

```powershell
E:\Codex\QuesIQ\QuesIQ App Worktrees\QuesIQ-dev
```

Primary all-up local gate:

```powershell
npm run test:interview-study:all
```

Command family:

```powershell
npm run test:interview-study:static
npm run test:interview-study:services
npm run test:interview-study:e2e
npm run test:interview-study:live-ai
npm run test:interview-study:all
```

What each command does:

- `test:interview-study:static`: runs Interview readiness, Study readiness,
  TypeScript, and ESLint.
- `test:interview-study:services`: seeds deterministic local Interview and
  Study data, verifies core DB persistence, and writes run artifacts.
- `test:interview-study:e2e`: starts an isolated Next dev server and runs the
  Interview + Study Playwright matrix.
- `test:interview-study:live-ai`: runs the existing live Interview turn smoke
  and Study evaluator smoke when a valid accepted key exists; otherwise it
  skips clearly.
- `test:interview-study:all`: runs static, service, and E2E gates in sequence.

## Required Local State

The primary local gate assumes:

- local Postgres is running on the configured `DATABASE_URL`
- migrations are applied
- dependencies are installed
- Playwright Chromium is installed

Typical setup:

```powershell
npm install
npm run playwright:install
npm run db:local:up
npm run db:local:migrate
npm run test:interview-study:all
```

The E2E suite starts its own isolated app server. You do not need the visible
development server at `http://127.0.0.1:3100` for these tests, and the test
server does not reuse that visible server.

## Isolated E2E Server

The Playwright config lives at:

```text
playwright.interview-study.config.ts
```

Default E2E URL:

```text
http://127.0.0.1:3210
```

Override port:

```powershell
$env:INTERVIEW_STUDY_E2E_PORT="3220"
npm run test:interview-study:e2e
```

The E2E server uses:

- `E2E_TEST_MODE=1`
- `E2E_AI_MODE=mock` by default
- `DEV_AUTH_BYPASS_ENABLED=1`
- `NEXT_DIST_DIR=.next-interview-study-e2e`
- a deterministic E2E admin account

The separate Next dist directory lets Playwright run beside the visible dev
server on port `3100`. The runner restores Next-generated TypeScript files after
the run so `next-env.d.ts` and `tsconfig.json` do not stay rewritten to the E2E
dist folder.

The E2E runner and server wrapper are:

```text
scripts/test/interview-study-e2e-runner.mjs
scripts/test/interview-study-e2e-server.mjs
```

## Seeded Test Data

The seed and service harness lives in:

```text
scripts/test/interview-study-regression.ts
scripts/test/interview-study-services.ts
tests/interview-study/global-setup.ts
```

Seeded data is intentionally marked with:

```text
[TEST_DELETE] Interview Study Regression
__test_delete__
```

The harness creates or updates a deterministic admin user:

```text
quesiq-e2e-admin@example.com
```

Override when needed:

```powershell
$env:E2E_TEST_EMAIL="custom-e2e-admin@example.com"
$env:E2E_TEST_PASSWORD="QuesIQe2e12345"
```

Seeded Study data includes:

- a folder
- two decks
- cards
- a deck stack with ordered decks
- one Study rating
- card-specific feedback rows for accurate and issue feedback

Seeded Interview data includes:

- a job target
- a custom Question Queue question
- a Story Lab story
- an Introduction
- a deterministic session snapshot

The service check verifies:

- Study seeded decks exist
- Study card feedback rows persist
- Interview session exists
- Interview custom question exists

## Authentication In E2E

The shared Playwright auth helper is:

```text
tests/e2e/support/auth.ts
```

For Interview + Study E2E, it prefers the guarded dev-auth route with role:

```text
e2e-admin
```

That role is only accepted when `E2E_TEST_MODE=1` and
`DEV_AUTH_BYPASS_ENABLED=1`. It maps to the seeded E2E admin user from the
local database instead of relying on concurrent browser form sign-ins. If the
test-mode dev-auth path is unavailable, the helper can still fall back to the
password login flow.

The route support is in:

```text
src/server/auth/dev-bypass.ts
src/app/api/dev-auth/session/route.ts
```

This is local/test-only behavior. Do not enable it for production.

## Browser Coverage

Playwright specs live in:

```text
tests/interview-study/interview-regression.spec.ts
tests/interview-study/study-regression.spec.ts
tests/interview-study/support/browser-errors.ts
tests/interview-study/support/seed-state.ts
```

Projects:

- desktop Chromium
- mobile Chrome using Pixel 7 device settings

The browser-error guard fails tests on unexpected console errors, page errors,
and failed HTTP responses. Expected harmless browser warnings are not treated as
failures, but app-owned 4xx/5xx failures should fail.

Interview browser coverage includes:

- authenticated Interview shell navigation
- Home, Practice, Story Lab, History, and Me surfaces
- Practice setup cards for Coaching, Rapid Fire, Mock Interview, and Hands-Free
  visibility
- Story Lab library visibility
- profile target, Question Queue, stories, and introductions API coverage
- create/edit/delete custom question API flow
- admin Interview test tunnel status route

Study browser coverage includes:

- dashboard, library, stack, and history surfaces
- seeded local decks and stack visibility
- visual flashcard flip forward and back
- Study card factual feedback: Accurate and Flag issue dialog/save
- Study ratings
- deck modes: flashcards, quiz, true/false, written, match, test, verbal, and
  memorize
- stack workflows, including stack study and stack memorize
- admin Study rich CSV import surface
- desktop and mobile shell behavior

## Mocked AI And Media Behavior

Browser regression uses deterministic mocks for AI-adjacent paths:

- Study TTS is routed to a fake audio response.
- Study answer evaluation is routed to a mocked successful verdict.
- Introduction draft is routed to a mocked structured draft.
- microphone-adjacent browser behavior uses fake media and recorder stubs.

This lets the primary gate run without real OpenAI, Realtime, microphone, or R2
credentials.

The browser suite can verify that the UI reaches recording, submit, feedback,
rating, and save states. It does not validate real microphone permission,
speaker quality, AirPods behavior, audio clipping, or true Realtime voice
conversation quality.

## Live AI Smoke

Run live model smoke explicitly:

```powershell
npm run test:interview-study:live-ai
```

Accepted key names:

- `OPENAI_INTERVIEW_TEST_TUNNEL_API_KEY`
- `OPENAI_STUDY_TEST_TUNNEL_API_KEY`
- `OPENAI_INTERVIEW_API_KEY`
- `OPENAI_STUDY_API_KEY`
- `OPENAI_API_KEY`

The command only treats OpenAI-style `sk-...` values as real live keys. If no
valid key is present, it exits successfully with a clear skip message.

When a valid key is present, it runs:

```powershell
npm run smoke:interview-turns
npm run smoke:study
```

Those smokes exercise:

- Interview Rapid Fire, Intro Practice, and Story Practice/TMAAT turn-based
  backend paths
- Study answer evaluator backend path, `study_evaluate` AI usage tracking, and
  disposable Study attempt persistence

The command prints key source names only, never secret values.

## Artifacts

Generated outputs live under:

```text
artifacts/interview-study-regression/
```

Important files:

- `seed-state.json`: IDs for the current seeded user, Interview rows, Study
  rows, decks, cards, and stack.
- `service-summary.json`: machine-readable service check summary.
- `run-report.md`: short human-readable service check report.
- `playwright-results/`: failed screenshots, videos, traces, and attachments.
- `playwright-report/`: HTML Playwright report.

The entire `artifacts/` folder is ignored by git.

## Deterministic Study Rendering

Several Study modes previously used `Math.random()` during first client render.
That can produce server/client hydration mismatches in Next/React. The
regression work introduced deterministic first-render ordering so the browser
suite can detect real app failures instead of noisy hydration mismatches.

Shared helper:

```text
src/features/study/deterministic-shuffle.ts
```

Study modes using deterministic first-render ordering include:

- visual flashcards
- quiz
- true/false
- written
- match
- test
- verbal
- memorize

Restart actions can still produce a fresh order after hydration by using a
time-based seed. The key rule is: do not call `Math.random()` or browser-only
APIs in state initializers that run during the first server/client render.

## Readiness Script Integration

The readiness scripts now check that this regression harness exists:

```text
scripts/interview/readiness-check.mjs
scripts/study/readiness-check.mjs
```

Interview readiness verifies:

- the command family exists
- the shared regression harness exists
- the Interview E2E markers exist

Study readiness verifies:

- the command family exists
- Study card feedback route and migration exist
- Study E2E markers exist for flip-back, factual feedback, and stack memorize

## Reimplementation Checklist

To rebuild this harness in a fresh checkout:

1. Confirm local Postgres and migrations work.
2. Add the package scripts for static, services, e2e, live-ai, and all-up
   commands.
3. Add `playwright.interview-study.config.ts` with a dedicated port, dedicated
   Next dist directory, desktop/mobile projects, global setup, and artifacts
   under `artifacts/interview-study-regression/`.
4. Add the E2E runner and E2E server wrapper so generated Next TypeScript files
   are restored after Playwright runs.
5. Add a guarded test-mode auth path for a seeded E2E admin user. Keep it behind
   `E2E_TEST_MODE=1` and `DEV_AUTH_BYPASS_ENABLED=1`.
6. Add the regression seed harness with cleanup and deterministic `[TEST_DELETE]`
   Interview and Study rows.
7. Add service checks that verify seeded DB persistence directly.
8. Add browser specs for Interview and Study. Keep selectors role-based and
   user-facing.
9. Add fake media, mocked Study AI/TTS, and mocked Introduction draft routes for
   browser tests.
10. Add browser error checks for console errors, page errors, and failed HTTP
    responses.
11. Fix first-render nondeterminism in Study client components before enforcing
    browser error checks.
12. Add live-AI smoke as an opt-in command that skips cleanly when no valid key
    exists.
13. Update readiness scripts and docs map so future builders can find the gate.
14. Run `npm run test:interview-study:all` and then
    `npm run test:interview-study:live-ai` when a valid test key is available.

## Troubleshooting

Port `3210` is busy:

```powershell
$env:INTERVIEW_STUDY_E2E_PORT="3220"
npm run test:interview-study:e2e
```

Playwright says browsers are missing:

```powershell
npm run playwright:install
```

Service checks fail because database rows are missing:

```powershell
npm run db:local:up
npm run db:local:migrate
npm run test:interview-study:services
```

Browser tests fail with unauthorized Study/admin routes:

- confirm `E2E_TEST_MODE=1` and `DEV_AUTH_BYPASS_ENABLED=1` are being set by
  `playwright.interview-study.config.ts`
- confirm the E2E user exists by rerunning `npm run test:interview-study:services`
- inspect `artifacts/interview-study-regression/seed-state.json`

Browser tests fail with hydration mismatch:

- inspect the failing page for `Math.random()`, `Date.now()`, locale-dependent
  formatting, or `typeof window` branches in initial render state
- prefer deterministic helper functions for first render
- move browser-only checks into post-load effects or event handlers

Live-AI command skips:

- set one accepted `OPENAI_*` test key locally
- use a real OpenAI-style `sk-...` value, not a placeholder like `true`

Live-AI command runs but fails:

- run `npm run smoke:interview-turns` and `npm run smoke:study` separately
- check local Postgres and migrations
- confirm the key has model access
- confirm the command reports only the key source name, not the secret

## Manual QA Boundary

The automated system intentionally does not claim to validate:

- real microphone permission prompts
- real microphone device selection
- AirPods or headset behavior
- audio clipping or speaker output quality
- true Realtime voice conversation quality
- production OAuth callback behavior
- production traffic or production writes

Those remain manual or future production-smoke work. The local regression gate
is the primary automated confidence check for Interview and Study functionality.
