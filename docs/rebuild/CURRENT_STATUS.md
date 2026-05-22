# Current Status

Last updated: 2026-05-22

## Rebuild Location

- Local repo: `C:\Users\weeks\Documents\GitHub\QuesIQ`
- GitHub repo: `ronnieav8r/QuesIQ`
- Living rebuild docs: `docs/rebuild/`
- Older Bubble handoffs and the older rebuild-doc copy in the OneDrive workspace
  are reference material unless deliberately resynced.

## Built So Far

- Rebuild plan, architecture, decisions, scope, and handoff docs
- Next.js TypeScript baseline and Render readiness files
- Responsive app shell with intentional mobile and desktop compositions
- Home, Practice, Stories, and Me navigation
- UI-only onboarding/interview-context flow with a fast path into practice
- Refactored interview UI components and typed seeded practice data
- Practice setup wizard with mode-specific question-type routing
- Client-side session setup snapshot and focused placeholder session screen
- Direct OpenAI Realtime browser voice spike from the session screen:
  - server-side `/api/realtime/session` WebRTC exchange route
  - browser microphone connect/disconnect controls
  - Que first-turn kickoff
  - transcript and recent-event debug surfaces

## Verification

The current coded app has passed:

- ESLint
- TypeScript check
- Next production build
- Manual direct OpenAI Realtime spike test on 2026-05-22:
  - Que starts the practice
  - audio quality is acceptable
  - recent events and transcript turns appear
  - disconnect stops the session cleanly

Ignored local/generated paths currently include `.env.local`, `.next/`,
`.tools/`, `node_modules/`, and `tsconfig.tsbuildinfo`.

## Current Product Direction

- Replace Bubble for the core QuesIQ Interview app.
- Use direct OpenAI Realtime first for the coded browser voice beta.
- Keep VAPI as a fallback if direct voice testing reveals a quality,
  reliability, transcript, or tooling gap.
- Keep Make for automation edges, not the interview session state machine.
- Que is the in-app coach. Quira remains the separate public/support assistant.
- Keep QuesIQ-owned session snapshots, transcripts/artifacts, evaluations,
  history, and progression in the app backend/data layer.
- Build both mobile and desktop intentionally while keeping practice setup and
  live voice focused.

## Next Work

1. Harden the direct OpenAI voice spike into the first real voice-session slice:
   readiness/error states, session status, transcript/event ownership, and clean
   end handling.
2. Choose the persistence/auth direction and create the first app-owned Session
   record before voice launch.
3. Decide transcript/artifact storage requirements for evaluation and privacy.
4. Create or confirm the Render test service path for deploy-based QA when local
   preview workflows are unreliable.

## Reference Inputs

- Bubble/Claude handoff:
  `C:\Users\weeks\OneDrive\Documents\QuesIQ\claude_handoffs\interview_prep_app_project_state (4).md`
- Living rebuild docs in this repo:
  `docs/rebuild/REBUILD_PLAN.md`
  `docs/rebuild/ARCHITECTURE.md`
  `docs/rebuild/PRODUCT_SCOPE.md`
  `docs/rebuild/DECISIONS.md`
  `docs/rebuild/HANDOFF.md`
