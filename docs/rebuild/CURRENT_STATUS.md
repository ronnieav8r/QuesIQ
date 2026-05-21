# Current Status

Last updated: 2026-05-21

## Rebuild Location

- Local repo: `C:\Users\weeks\Documents\GitHub\QuesIQ`
- GitHub repo: `ronnieav8r/QuesIQ`
- Working docs: `docs/rebuild/`

## Built So Far

- Rebuild plan, architecture, decisions, and product-scope docs
- Next.js TypeScript baseline
- Local portable Node/npm toolchain under ignored `.tools/` for Codex work
- Initial dashboard-first UI shell
- Home, Practice, Stories, and Me navigation
- Practice setup wizard with mode-specific step routing
- Render readiness files:
  - `render.yaml`
  - `.node-version`
  - Node engine pin

## Verification

The current scaffold has passed:

- `npm run lint`
- `npm run typecheck`
- `npm run build`

`npm audit` reported a moderate PostCSS advisory through Next.js where the
automatic forced fix suggested a bad breaking downgrade path. Do not apply that
forced fix blindly; revisit dependency/security posture as the app matures.

## Current Product Direction

- Replace Bubble for the core QuesIQ Interview app.
- Keep VAPI for the first coded voice beta.
- Keep Make for automation edges, not the interview session state machine.
- Que is the in-app coach. Quira remains the separate public/support assistant.
- Build both mobile and desktop intentionally:
  - mobile stays focused and touch-friendly
  - desktop can use wider workspace for dashboard, reviews, stories, and history
  - practice setup and live voice stay focused across sizes

## Next Work

1. Create a separate Render service from the new GitHub repo.
2. Refine the responsive shell so desktop and mobile each feel deliberate.
3. Build onboarding and interview context:
   - preferred name
   - target role/company
   - optional job description and resume path
   - fast path into first practice
4. Choose auth and database tooling when persistence work begins.

## Reference Inputs

- Bubble/Claude handoff:
  `C:\Users\weeks\OneDrive\Documents\QuesIQ\claude_handoffs\interview_prep_app_project_state (4).md`
- Rebuild docs in this repo:
  `docs/rebuild/REBUILD_PLAN.md`
  `docs/rebuild/ARCHITECTURE.md`
  `docs/rebuild/PRODUCT_SCOPE.md`
  `docs/rebuild/DECISIONS.md`
