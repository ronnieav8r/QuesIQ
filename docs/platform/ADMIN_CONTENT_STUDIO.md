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

## Runs

The current Admin slice adds a Content Studio run route at
`/api/admin/content-studio/runs`.

- `GET` returns durable AI-call history for Study flashcard draft runs when
  existing `ai_runs` records have `rawJson.operation =
  "study_content_studio_flashcard_draft"`.
- `POST` orchestrates Study flashcard draft generation by calling the
  Study-owned draft primitive. The returned deck draft is held as current
  Admin review state in the browser.
- DPE content draft generation is wired through the same Admin run route using
  the product-owned `/api/dpe/content/draft` primitive. It returns certificate,
  ACS, oral-question, answer-key, rubric, confidence, warnings, readiness, and
  missing-field indicators for review without writing to DPE content tables.
- Publish, Official, and Verified state changes remain out of scope.

Existing `ai_runs` storage is useful for AI-call audit history, but it is not a
complete Content Studio run ledger. Durable review state still needs dedicated
storage for source intake metadata, selected template, full draft payload,
reviewer notes, stage transitions, and future publish audit events.

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
