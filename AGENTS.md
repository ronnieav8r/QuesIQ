# Agent Notes

## Active Interview Implementation Plan

For Interview work, first read
`docs/rebuild/INTERVIEW_IMPLEMENTATION_ROADMAP_2026-09-06.md` and
`docs/rebuild/INTERVIEW_EXECUTION_STATUS.md`. The user approved sequential
implementation on 2026-09-06. This roadmap overrides older Interview planning
and voice-engine guidance; the execution status identifies the next unaccepted
task and evidence. Do not restart completed tasks or skip acceptance gates.

Use this `QuesIQ-dev` checkout on `codex/interview-mobile` for the local Interview
lane; the legacy manager-workspace path below does not override this routing.
Use one bounded worker by default, selecting the lowest suitable model and
reasoning per task: Luna low for clear small tasks, Luna medium or Terra only
when complexity warrants it. No recursive delegation. The manager reviews the
diff and tests before integration/checkpointing; escalate after one unsuccessful
correction round rather than repeating blindly. Record model/effort and outcomes.
Keep shared-file/schema/auth changes serialized and preserve existing work.
No direct PC control, paid model runs, audio/operator tests, or deployment is
authorized by the roadmap alone. Keep the framed silent test bed as the default.

Use `docs/README.md` for the document map.
Read `docs/rebuild/HANDOFF.md`, `docs/rebuild/CURRENT_STATUS.md`, and
`docs/rebuild/DECISIONS.md` before broad resume exploration.
Read `docs/rebuild/INTERVIEW_REGRESSION.md` before changing or relying on
the Interview local regression gate.
Read `docs/platform/ONE_SERVICE_PLATFORM.md` and
`docs/platform/PARALLEL_DEVELOPMENT.md` before importing another product,
changing route structure, or editing shared platform/auth/schema files.
Read `docs/rebuild/BRANCHING_AND_RELEASES.md` before changing production branch
or deploy flow.

The active manager workspace is
`C:\Users\weeks\Documents\github\QuesIQ-workspace\QuesIQ-manager`. The older
`C:\Users\weeks\Documents\github\QuesIQ` checkout is reference/archive unless a
manager explicitly says otherwise.

Older planning docs such as `docs/rebuild/REBUILD_PLAN.md`,
`docs/rebuild/NEXT_STEPS.md`, and `docs/strategy/*` are historical guidance.
They should not override the active docs listed above.

## Working Direction

- This repository is becoming the one-service QuesIQ platform tree. QuesIQ
  Interview remains the most complete coded product and should stay stable while
  Study, QuesIQ DPE, marketing, and future products are imported into separate
  product lanes.
- Bubble and older handoffs are reference material, not implementation
  constraints.
- Use direct OpenAI Realtime first for the coded browser voice beta; keep VAPI as
  fallback unless the current decisions docs change.
- Keep shared auth/account/platform code generic. Keep product-specific session,
  evaluation, progression, content, prompt, and product data in product-owned
  lanes keyed by the shared Auth.js user id.
- Products can move in parallel. Perpetual lane worker chats are deprecated;
  use objective-scoped subagents and the lane clones only when parallel work or
  isolated review is useful. Platform changes, auth changes, schema migrations,
  route-shell changes, and release merges should be serialized.
- Build thin runnable slices and keep the plan docs current when durable
  decisions change.
- Mobile-facing Interview preview features belong inside the shared iPhone and
  Pixel frames at `/interview/mobile-preview`, with one mirrored session state.
  This is the default local Interview test bed: open directly to **Test Coaching
  · no audio** in Fit view with Simulation selected. Reset returns to this framed
  test view. Never start a test or paid model call automatically on page load.
  Keep developer setup, prompts, traces, and exports outside the phone UI. Verify
  frame-contained scrolling and small/large layouts with isolated headless tests;
  do not control the user's desktop or browser when they have asked not to.
- When adding a new AI feature or OpenAI call, include Admin AI Usage
  instrumentation in the same slice: Responses API calls should create
  `ai_runs` records, and app-owned Realtime voice sessions should save usage
  after artifacts persist.
- For Interview regression work, prefer the dedicated local gate:
  `npm run test:interview:all`. Use `npm run test:interview:live-ai` only when
  intentionally exercising real model paths with accepted test keys. The
  detailed setup, coverage, and reimplementation guide is
  `docs/rebuild/INTERVIEW_REGRESSION.md`.
