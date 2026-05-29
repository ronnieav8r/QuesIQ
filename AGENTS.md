# Agent Notes

Use `docs/README.md` for the document map.
Read `docs/rebuild/HANDOFF.md` and `docs/rebuild/CURRENT_STATUS.md` before
broad resume exploration.
Read `docs/rebuild/REBUILD_PLAN.md` before major product or architecture work.
Read `docs/rebuild/PLATFORM_READINESS.md` before shared-platform, Study,
billing, auth-boundary, or design-system extraction work.
Read `docs/platform/ONE_SERVICE_PLATFORM.md` and
`docs/platform/PARALLEL_DEVELOPMENT.md` before importing another product,
changing route structure, or editing shared platform/auth/schema files.
Read `docs/rebuild/BRANCHING_AND_RELEASES.md` before changing production branch
or deploy flow.

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
