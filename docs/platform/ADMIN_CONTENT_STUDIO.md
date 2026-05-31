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

## Workspace Organization

Content Studio now uses internal workspace navigation so admins can move quickly
between operational surfaces without scrolling through one long page.

Top-level workspace sections:

- Overview / Run history: pipeline intake and draft generation controls, stage
  framing, and durable run history.
- Source review: source-pack paste preview plus source-pack chunk/figure/table
  review scaffold and durable review-export save actions.
- Product packet preview: preview-only Study generation packet, Study deck
  draft + verifier queue packet, and DPE reference packet bridge.
- Study import prep: rich flashcard CSV preview/import surface with admin deck
  targeting and column mapping.
- Draft review: saved run review state and draft detail panels for the selected
  run.

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
- `POST /api/admin/content-studio/source-pack-review-runs` saves a pasted or
  locally edited source-pack review export as a durable Admin review artifact
  in `content_studio_runs` using the Study pipeline lane. It does not run AI,
  import Study decks, write DPE data, publish content, or mark Official or
  Verified state.
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

## Source-Pack Review

Content Studio now includes a read-only scaffold for source-pack review. This
is intentionally contract-first and Admin-only: it does not read local
source-pack folders, call Google Drive, save review decisions, send raw
source-pack data into Study or DPE runtime paths, or write publish state. The
first UI goal is to let an admin review a batch of source-pack candidates in
one place once the manager-owned Codex source-scrubber and generation skills can
provide source-pack data.

Target source-pack layout:

```txt
manifest.json
source-pages.jsonl
chunks.jsonl
figures.jsonl
tables.jsonl
figures/
pages/
tables/
```

Future Admin API boundary should return normalized manifest metadata, chunk
candidates from `chunks.jsonl`, and visual candidates from `figures.jsonl` and
`tables.jsonl`.

Manifest-level fields:

```json
{
  "id": "demo-source-pack-contract",
  "title": "Source-pack review contract demo",
  "createdAt": "2026-05-31T10:00:00.000Z",
  "sourceIds": ["source-pack-guide", "dpe-reference-pack"],
  "sourceCount": 2,
  "chunkCount": 3,
  "figureCount": 1,
  "tableCount": 2
}
```

Chunk candidate fields:

```json
{
  "chunkId": "chunk-source-pack-layout",
  "sourceId": "source-pack-guide",
  "sourceTitle": "Source Pack Implementation Guide",
  "page": 14,
  "anchor": "source-pack-guide#page=14&chunk=chunk-source-pack-layout",
  "excerpt": "Short chunk text preserved for review.",
  "contextBefore": "Optional surrounding context.",
  "subjects": ["Admin Content Studio"],
  "tags": ["manifest", "chunks", "provenance"],
  "useCases": ["review orientation", "source QA"],
  "relatedFigureIds": ["fig-source-pack-flow"],
  "relatedTableIds": [],
  "reviewDecision": "candidate",
  "reviewNotes": "Admin notes for future review persistence."
}
```

Visual candidate fields:

```json
{
  "id": "fig-source-pack-flow",
  "sourceId": "source-pack-guide",
  "sourceTitle": "Source Pack Implementation Guide",
  "type": "figure",
  "page": 14,
  "figureLabel": "Figure 2",
  "tableLabel": null,
  "caption": "Source-pack flow diagram.",
  "subject": "Admin Content Studio",
  "topic": "Reusable ingestion contracts",
  "subtopics": ["source packs", "provenance"],
  "useCases": ["review orientation", "content QA"],
  "relatedChunkIds": ["chunk-source-pack-layout"],
  "sourceExcerpt": "Short source/chunk context excerpt for review.",
  "pageAssetPath": "pages/source-pack-guide-page-014.png",
  "reviewAssetPath": "figures/fig-source-pack-flow.review.png",
  "assetPath": "figures/fig-source-pack-flow.png",
  "bbox": [0.18, 0.24, 0.74, 0.52],
  "instructionalValue": "Useful as an admin orientation visual.",
  "keepRecommendation": "keep",
  "reviewDecision": "candidate",
  "reviewStatus": "rendered_page",
  "reviewNotes": "Needs final crop review."
}
```

Accepted `reviewDecision` values are `candidate`, `keep`, `reject`,
`needs_edit`, and `accepted`. These are review labels only until a future
explicit persistence endpoint exists.

The Admin-side review run contract should normalize those labels into a summary
bucket set for workflow decisions:

```json
{
  "id": "demo-source-pack-contract-admin-review",
  "manifestId": "demo-source-pack-contract",
  "stage": "admin_review_scaffold",
  "reviewCounts": {
    "accepted": 2,
    "rejected": 1,
    "needs_edit": 2,
    "candidate": 1
  },
  "decisions": [
    {
      "candidateId": "chunk-source-pack-layout",
      "candidateType": "chunk",
      "sourceId": "source-pack-guide",
      "sourceAnchor": "source-pack-guide#page=14&chunk=chunk-source-pack-layout",
      "reviewDecision": "accepted",
      "reviewBucket": "accepted",
      "reviewedAssetIds": ["fig-source-pack-flow"],
      "reviewerNotes": "Keep as review context, not product content."
    }
  ]
}
```

`POST /api/admin/content-studio/source-pack-preview` is the first safe API
boundary for this contract. It accepts a pasted JSON review bundle only, then
returns normalized manifest metadata, chunk candidates, figure/table candidates,
review counts, decision records, and validation notes. It does not read server
files, access Google Drive, persist review decisions, create Content Studio run
rows, or call Study/DPE generation routes.

`POST /api/admin/content-studio/source-pack-review-runs` is the durable artifact
boundary for the current export JSON. It requires
`stage: "source_pack_admin_review_export_preview"`, manifest id/title/source ids,
review run id, review counts, accepted chunk and visual ids, reviewed visual ids,
reviewer notes, source anchors, and restrictions that keep Drive loading,
product imports, Publish, Official, and Verified writes disabled. The saved run uses
`templateKey: "source_pack_review_export"` and a Study-shaped draft payload with
`cards: []` so the existing run history and reopen UI remain stable.

The current UI shows disabled future actions for `Accept selected`, `Reject
selected`, `Generate Study draft from accepted chunks`, and `Generate DPE draft
later`. These buttons are deliberate affordances only. They must stay disabled
until review persistence and Codex-side generation/export endpoints exist.

The UI can now edit review decisions and reviewer notes locally for previewed
chunks, figures, and tables. These controls update the on-screen review summary
and copyable export preview. The export can also be saved as a durable Admin
review artifact and reopened from run history. Reopen currently displays the
saved artifact JSON and summary; restoring each saved decision into the editable
source-pack candidate controls remains future work.

The export preview contract is intended for Codex-side generation tools:

```json
{
  "stage": "source_pack_admin_review_export_preview",
  "manifest": {
    "id": "demo-source-pack-contract",
    "title": "Source-pack review contract demo",
    "sourceIds": ["source-pack-guide"]
  },
  "reviewRunId": "demo-source-pack-contract-admin-review",
  "reviewCounts": {
    "accepted": 2,
    "rejected": 1,
    "needs_edit": 2,
    "candidate": 1
  },
  "acceptedChunkIds": ["chunk-source-pack-layout"],
  "acceptedVisualIds": ["fig-source-pack-flow"],
  "reviewedVisualIds": ["fig-source-pack-flow", "tbl-visual-schema"],
  "notes": [
    {
      "candidateType": "chunk",
      "candidateId": "chunk-source-pack-layout",
      "note": "Keep as review context, not product content."
    }
  ],
  "sourceAnchors": [
    {
      "candidateType": "chunk",
      "candidateId": "chunk-source-pack-layout",
      "sourceId": "source-pack-guide",
      "sourceAnchor": "source-pack-guide#page=14&chunk=chunk-source-pack-layout"
    }
  ],
  "restrictions": [
    "admin_review_export_preview_only",
    "no_drive_loading",
    "durable_admin_artifact_only",
    "no_product_import",
    "no_publish_official_or_verified_write",
    "study_generation_first_dpe_later"
  ]
}
```

Accepted initial `reviewStatus` values are:

- `metadata_only`: record exists, but no browser-previewable asset is available.
- `rendered_page`: the source page has been rendered for page-level review.
- `cropped_candidate`: a candidate crop exists but has not been accepted.
- `cropped_reviewed`: a reviewer accepted or intentionally kept the crop.

Accepted `keepRecommendation` values are `keep`, `review`, and `skip`.

The future API should avoid browser filesystem access. It should either return
admin-authorized URLs for previewable assets or return metadata-only rows with
asset paths preserved for traceability. Saving figure/table review decisions
should be a separate explicit review endpoint and must not publish product
content, mark Official content, or mark Verified content.

Study and DPE imports remain future work. The intended sequence is Admin review
and Codex-side generation/verification skills first, then approved generated
Study deck drafts or DPE draft handoffs only after product-owned import and
publish controls exist.

## Product Packet Preview Bridge

Content Studio also includes a preview-only bridge for product packets generated
by Codex-side tools after Admin source-pack review. This is an Admin UI
inspection surface only; it does not import content, load Drive files, read
server source-pack folders, publish content, mark Official content, mark
Verified content, or persist source-pack storage.

Supported preview packet types:

- Study generation packet: `POST /api/study/content-studio/flashcard-draft`
  with `mode: "source_pack_generation_packet_preview"` and
  `generationPacketJson`.
- Study deck draft: `POST /api/study/content-studio/flashcard-draft` with
  `mode: "source_pack_preview"` and then
  `mode: "source_pack_verification_queue_preview"` using the same
  `sourcePackDraftJson`.
- Study deck draft durable review save:
  `POST /api/study/content-studio/flashcard-draft` with
  `mode: "source_pack_draft_run_save"` and `sourcePackDraftJson`. The Study
  route validates the `study.sourcePackDeckDraft.v1` payload, builds the
  preview verifier queue, and saves a durable Admin review artifact row in
  `content_studio_runs` with pipeline `study_flashcards`, template
  `source_pack_deck_draft`, stage `source_pack_study_deck_draft_review`, and
  status `draft_ready`.
- DPE reference packet: `POST /api/dpe/content/draft` with
  `mode: "source_pack_reference_packet_preview"` and `referencePacket`.

The Study preview shows the normalized source pack id/title, chunk count, deck
request details, and review sections returned by the Study-owned preview
parser. The Study deck-draft preview shows draft metadata, card counts,
verification status, source citation coverage, warning/status counts, and a
preview-only verifier queue. The DPE preview shows item count, source chunk
count, visual asset count, track applicability, verification-status counts,
source pack details, and warnings returned by the DPE-owned reference parser.

This bridge is intentionally downstream of Admin review and upstream of any
product import. It exists so reviewers can inspect the backend-normalized packet
shape before future Codex-side generation/export workflows are allowed to create
Study deck drafts or DPE reference data.

The durable Study source-pack draft save mode is still review-only scaffolding.
It does not read local source-pack folders, load Drive content, call verifier
AI, import Study runtime decks/cards, publish content, or mark Official or
Verified state.

## Study Import Prep

The Study import prep workspace supports admin-operated rich CSV ingestion for
Study decks using Study-owned preview/save modes. It includes:

- Rich CSV paste and preview (`mode: "rich_csv_import_preview"`).
- Deck targeting (`create new deck` or `existing deck id`) for save mode.
- Column mapping UI that maps detected CSV headers to rich import fields and
  sends `columnMapping` in preview/save payloads.
- Skill-aligned default mapping for these exporter headers:
  `externalId`, `deckTitle`, `deckDescription`, `subject`, `audience`,
  `question`, `answer`, `hint`, `level`, `tags`, `sourcePackId`,
  `sourcePackTitle`, `sourceChunkIds`, `sourcePages`, `sourceVisualAssetIds`,
  `sourceLabel`, `sourceUrl`, `sourceNotes`, `draftId`, `draftConfidence`,
  `draftWarnings`, `verificationStatus`, `verificationConfidence`,
  `verificationNotes`, `verificationEvidence`, `verifier`.

Guardrails still apply: no Drive loading, no raw source-pack runtime reads, no
DPE runtime writes, and no Publish/Official broad Verified behavior in Admin.

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
