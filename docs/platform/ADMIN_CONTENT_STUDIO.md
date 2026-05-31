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

The Admin run ledger now has dedicated durable storage in
`content_studio_runs`. `ai_runs` remains the AI-call audit table and can be
linked from a Content Studio run when a provider call exists.

- `GET /api/admin/content-studio/runs` returns durable Content Studio runs with
  source snapshots, source metadata, selected template, full draft payload,
  confidence, warnings, missing fields, reviewer checklist/summary, reviewer
  notes, stage/status, admin user, timestamps, and optional `ai_run` reference.
- `POST /api/admin/content-studio/runs` orchestrates Study flashcard draft
  generation by calling the Study-owned draft primitive, then creates a durable
  run record for Admin review.
- DPE content draft generation is wired through the same Admin run route using
  the product-owned `/api/dpe/content/draft` primitive. It returns certificate,
  ACS, oral-question, answer-key, rubric, confidence, warnings, readiness, and
  missing-field indicators for review without writing to DPE content tables,
  then creates the same durable run record.
- DPE run intake can include an Admin track context preset for MVP target tracks
  (Instrument, Commercial, CFI, CFII, Multi, MEI). This context preloads
  certificate metadata for generation/review only and is saved with run
  metadata for reopenable review state.
- `GET/PATCH /api/admin/content-studio/runs/[runId]` reopens a saved run and
  persists reviewer notes plus review status changes such as `draft_ready`,
  `needs_revision`, `approved_for_publish`, and `archived`.
- Publish, Official, and Verified state changes remain out of scope. The
  `approved_for_publish` status is an internal review state only; it does not
  write Study decks, DPE questions, Official status, or Verified state.

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
