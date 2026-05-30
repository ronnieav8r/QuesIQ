# Agent Notes

Use `docs/README.md` for the document map.
Read `docs/rebuild/HANDOFF.md`, `docs/rebuild/CURRENT_STATUS.md`, and
`docs/rebuild/DECISIONS.md` before broad resume exploration.
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
- Products can move in parallel. Platform changes, auth changes, schema
  migrations, route-shell changes, and release merges should be serialized.
- Build thin runnable slices and keep the plan docs current when durable
  decisions change.
- When adding a new AI feature or OpenAI call, include Admin AI Usage
  instrumentation in the same slice: Responses API calls should create
  `ai_runs` records, and app-owned Realtime voice sessions should save usage
  after artifacts persist.
