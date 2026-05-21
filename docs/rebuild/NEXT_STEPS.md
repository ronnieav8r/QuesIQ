# Next Steps

## Current State

- New rebuild repo exists at `C:\Users\weeks\Documents\GitHub\QuesIQ`.
- Next.js TypeScript scaffold exists and passed lint, typecheck, and build.
- First UI slice exists:
  - dashboard-first Home
  - Home / Practice / Stories / Me navigation
  - practice setup wizard
  - mode routing that skips or includes question type by mode
- Render deployment files are in the GitHub repo.
- Bubble reference material remains in the older QuesIQ workspace.

## Immediate

1. Create the separate Render service for the rebuild from
   `ronnieav8r/QuesIQ`.
2. Pull/fetch the latest remote GitHub changes into the local clone before the
   next local commit cycle.
3. Refine the responsive UI into intentional mobile and desktop compositions.
4. Build onboarding and interview context before live VAPI integration.
5. Choose auth provider and ORM/migration tool when the first persistence slice
   begins.

## First Implementation Backlog

- Refine app shell for mobile and desktop layout variants
- Add onboarding/profile flow and data model
- Seed practice mode setup records
- Move practice setup from UI-only state toward session setup data
- Create Session record before voice launch
- Add placeholder session page and review page

## First VAPI Backlog

- Define Que assistant config builder
- Decide stored versus transient assistant launch path for the web app
- Implement VAPI session launch from custom page
- Correlate VAPI call ID with our Session row
- Receive end-of-call webhook
- Store transcript artifact
- Run backend evaluation and route to review

## Things Not To Do First

- Do not rebuild VAPI.
- Do not port every Bubble screen blindly.
- Do not bury the first voice practice session behind optional profile work.
- Do not make Make the core state machine for interview sessions.
