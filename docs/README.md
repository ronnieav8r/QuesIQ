# QuesIQ Docs Map

This folder is split by how the documents should be used. When documents
conflict, prefer the active source-of-truth docs below over older planning,
strategy, or reference notes.

## Active Source Of Truth

Start here for broad resume work and manager handoffs:

- `docs/rebuild/HANDOFF.md`: current resume snapshot and product handoff.
- `docs/rebuild/CURRENT_STATUS.md`: current platform status and deployment
  context.
- `docs/rebuild/DECISIONS.md`: durable product and architecture decisions.
- `docs/rebuild/BRANCHING_AND_RELEASES.md`: manager/worker branch flow,
  release flow, and branch sync states.
- `docs/rebuild/V1_BETA_READINESS.md`: automated readiness checks and manual
  QA boundaries for V1 beta.
- `docs/platform/PARALLEL_DEVELOPMENT.md`: product lane boundaries and
  parallel-development guardrails.
- `docs/platform/ADMIN_CONTENT_STUDIO.md`: shared Admin Content Studio
  direction, stage boundaries, and product handoff rules.
- `docs/platform/CODEX_CONTENT_SKILLS.md`: local Codex content skills for
  source ingestion, Study deck generation, verification, and DPE references.
- `docs/platform/ONE_SERVICE_PLATFORM.md`: one-service platform architecture.

## Historical Rebuild Planning

These files are retained for traceability. They may guide future work, but they
should not override the active source-of-truth docs:

- `docs/rebuild/ARCHITECTURE.md`
- `docs/rebuild/NEXT_STEPS.md`
- `docs/rebuild/PLATFORM_READINESS.md`
- `docs/rebuild/PRODUCT_SCOPE.md`
- `docs/rebuild/REBUILD_PLAN.md`
- `docs/rebuild/TRANSCRIPT_NORMALIZATION_DECISION.md`

## Platform Docs

Use `docs/platform/` for active one-service platform architecture and
parallel-development boundaries.

Current platform docs:

- `docs/platform/ONE_SERVICE_PLATFORM.md`
- `docs/platform/PARALLEL_DEVELOPMENT.md`
- `docs/platform/CODEX_CONTENT_SKILLS.md`

## Product Docs

Use `docs/products/` for product-specific notes that should not leak into the
shared platform layer.

Current product docs:

- `docs/products/interview/README.md`
- `docs/products/interview/QA_CHECKLIST.md`
- `docs/products/study/README.md`
- `docs/products/study/HANDOFF.md`
- `docs/products/dpe/README.md`
- `docs/products/quira/README.md`

## Strategy Docs

Use `docs/strategy/` for future-facing plans that may guide later decisions but
are not yet active implementation constraints.

Current strategy docs:

- `docs/strategy/DPE_PILOT_APP_ALIGNMENT_GUIDE.md`
- `docs/strategy/platform-integration-plan.md`

## Reference Docs

Use `docs/reference/` for preserved startup notes, imported context, older
handoffs, and other historical material. These files are intentionally retained
for memory and traceability, but they should not override the living rebuild
docs.
