# Admin Content Studio

Last updated: 2026-05-30

## Direction

Admin Content Studio is the shared content operations surface for current and
future QuesIQ products. It belongs to the protected `/admin` console and should
stay in the shared Admin lane unless a product worker is asked to integrate a
product-specific publishing endpoint.

The first priority pipelines are:

- Study flashcard sets: source material becomes deck drafts with terms,
  definitions, hints, taxonomy, and trust metadata.
- DPE content: source material becomes oral questions, answer keys, rubrics,
  ACS references, and reviewer notes.

## Stages

Generation and verification are separate stages:

1. Scrub: normalize pasted source material, imported files, or links, and keep
   source references.
2. Generate: create draft product artifacts from a selected pipeline and
   reusable template.
3. Verify: run a separate quality pass against source material, product rules,
   and confidence thresholds.
4. Review: let an admin inspect diffs, confidence, missing sources, and product
   fit.
5. Publish: write approved content only after backend audit records and
   product-specific publish controls exist.

The initial UI intentionally keeps scrub, generate, verify, and publish actions
disabled until backend endpoints and audit storage are ready.

## Ownership

Shared Admin owns:

- `src/features/admin/`
- `src/app/admin/`
- `src/app/api/admin/`
- `src/server/admin*`
- Admin/platform docs and lane guard updates

Product workers own product-specific generation endpoints, schema changes, and
publish behavior under their product lanes. If Content Studio needs a Study or
DPE endpoint, the Admin worker should document the handoff rather than editing
product-owned code by default.
