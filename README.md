# QuesIQ Interview

This repository is the custom coded rebuild of QuesIQ Interview.

## Direction

- Replace the Bubble app with a codebase we own.
- Keep VAPI as the first voice runtime for live interview practice.
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

Open the local app at `http://localhost:3000`.

## Render

The rebuild should deploy as its own Render web service from this repo. The
included `render.yaml` uses the app's Node server shape so later auth, API,
database, and VAPI webhook work can fit without changing deployment type.

## Plan

Start with `docs/rebuild/REBUILD_PLAN.md`.
