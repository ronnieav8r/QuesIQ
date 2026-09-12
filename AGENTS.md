# Agent Notes

## Active Interview Implementation Plan

Interview mobile v1 is the user's exclusive current QuesIQ priority until the
user explicitly changes it. Keep work within the Interview lane and exclude
Study, DPE, NCLEX, Quira, content production, broad platform expansion, and
production integration unless shared infrastructure is strictly necessary to
verify Interview behavior.

For Interview work, first read `PROJECT_STATE.md` as the concise restart
pointer, then
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
Apple Developer Program enrollment is an external device-signing gate, not a
reason to skip the approved local task order or claim iPhone readiness.

Use `docs/README.md` for the document map.
For broad platform exploration, consult relevant sections of
`docs/rebuild/HANDOFF.md`, `docs/rebuild/CURRENT_STATUS.md`, and
`docs/rebuild/DECISIONS.md`. For a focused Interview resume, the state pointer,
execution ledger and active roadmap are the entry point; read historical
sections only when needed to resolve a specific question.
At meaningful milestones, update the ledger and refresh `PROJECT_STATE.md`
together. The pointer must not become a competing acceptance ledger.
Read `docs/rebuild/INTERVIEW_REGRESSION.md` before changing or relying on
the Interview local regression gate.
Read `docs/platform/ONE_SERVICE_PLATFORM.md` and
`docs/platform/PARALLEL_DEVELOPMENT.md` before importing another product,
changing route structure, or editing shared platform/auth/schema files.
Read `docs/rebuild/BRANCHING_AND_RELEASES.md` before changing production branch
or deploy flow.

Historical workspace references:
`C:\Users\weeks\Documents\github\QuesIQ-workspace\QuesIQ-manager` and
`C:\Users\weeks\Documents\github\QuesIQ` are not the active Interview
checkout. Their existence does not authorize migration or retirement. Use this
E: checkout for local Interview work and the umbrella routing for other lanes.

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
- Older Realtime-first/VAPI guidance describes the historical browser beta.
  The approved Interview roadmap controls current voice-engine work; it does
  not itself authorize provider changes or paid tests.
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
