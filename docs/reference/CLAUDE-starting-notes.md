# Claude Starting Notes

Reference status: preserved startup context from the beginning of the coded
rebuild. This file may contain stale assumptions and should not override
`AGENTS.md` or the living docs in `docs/rebuild/`.

Start with `docs/rebuild/REBUILD_PLAN.md` and `docs/rebuild/ARCHITECTURE.md`.

This repo is the coded QuesIQ Interview rebuild:

- Que is the in-app interview coach.
- Quira is the separate public/support chat assistant.
- VAPI remains the first voice runtime.
- The app should own its data model, UI, session lifecycle, evaluation, and
  progression outside Bubble.
