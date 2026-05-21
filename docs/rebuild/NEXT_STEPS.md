# Next Steps

## Immediate

1. Choose whether the coded rebuild gets a new GitHub repo.
2. Choose the first technical stack defaults:
   - Next.js
   - Postgres
   - auth provider
   - ORM/migrations
3. Inventory required credentials and environment variables.
4. Scaffold the app and deployment baseline.

## First Implementation Backlog

- Create app shell and design tokens
- Create protected app layout and bottom navigation
- Add onboarding/profile data model
- Seed practice mode setup records
- Build practice setup wizard
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
