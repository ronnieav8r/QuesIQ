# QuesIQ V1 Beta Readiness

This checklist separates automated release-readiness checks from manual QA.
It is not aviation-specific; "readiness" means the app has the expected code,
configuration hooks, and guardrails before beta testing.

## Automated Checks

Run before a V1 beta build:

```bash
npm run readiness:mvp
npm run typecheck
npm run lint
npm run build
```

Product-level checks:

- `npm run readiness:interview`
- `npm run readiness:study`
- `npm run readiness:dpe`

These scripts are static checks. They do not start the local server, open a
browser, require microphone access, or prove production voice quality.

## Interview

Automated checks should cover:

- core Interview app routes, API routes, and server modules
- shared first-turn instruction source and Admin prompt visibility
- retired First Impression practice-mode behavior
- review timing and "too short to score" behavior
- session/job-target/story/introduction ownership guard markers
- OpenAI usage instrumentation markers for Interview AI calls
- missing local env vars as warnings, not local blockers

Manual QA still required:

- signed-in production browser flow
- microphone permission and Realtime voice session quality
- first-turn behavior against real saved targets
- review/debrief quality after realistic practice length

## Study

Automated checks should cover:

- core Study routes, API routes, and server modules
- rich CSV import parser, default mapping, mapped-header support, and parser
  smoke test
- Study Admin CSV import preview/save, Official deck marking, and stack
  assignment controls
- source and verification metadata display
- admin/auth guard markers
- disabled Publish, Official, and broad Verified boundaries
- missing DB/R2/OpenAI env vars as warnings, not local blockers

Manual QA still required:

- signed-in production browser flow
- Study deck create/edit/import/review/export paths
- production DB migration/seed verification when `DATABASE_URL` is available
- R2-backed Study TTS cache behavior when storage env vars are available
- real curated beta deck import and review

## DPE

Use the existing DPE readiness check plus manual voice/runtime QA. DPE is still
content-pending outside the intentionally configured Private Pilot ASEL path.

## Known Local Constraint

The local dev server is currently treated as unavailable for this thread. Do
not count local browser QA as completed unless the user explicitly reopens that
path.
