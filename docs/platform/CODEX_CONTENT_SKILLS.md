# QuesIQ Codex Content Skills

These are local Codex skills used to prepare source material, draft Study
decks, verify cards, and create DPE reference packets. They are not app
features by themselves. They are reusable Codex workflows that create reviewed
artifacts for Admin Content Studio and product import flows.

## How To Call A Skill

In a Codex chat, name the skill and give the source path plus the desired
output. Codex should load the skill automatically when the task matches its
description.

Example:

```text
Use quesiq-study-content-pipeline on the PHAK source pack. Create a reviewed
Study deck draft for Chapter 2, include source chunks/pages/visuals, run source
verification, and export a rich Admin CSV for Content Studio import.
```

For full handbook work, prefer a separate Codex thread using a stronger model
and bounded chapter/subject packets. Do not ask one prompt to create the entire
PHAK deck in one pass.

## Skills

| Skill | Use It For | Main Output | Limitation |
| --- | --- | --- | --- |
| `quesiq-source-scrubber` | Ingest PDFs, Markdown, webpages, or text into reusable source material. | Source pack with manifest, chunks, page anchors, clean text, and visual/table candidates. | It does not create final Study cards or mark anything Verified. |
| `quesiq-study-deck-drafter` | Create Study flashcard draft JSON from reviewed source chunks. | `study.sourcePackDeckDraft.v1` plus optional rich Admin CSV. | Draft quality depends on source review and model quality; cards still need verification. |
| `quesiq-study-verifier` | Check drafted cards against source-pack evidence and trusted sources. | Verification JSON with status, confidence, evidence, and recommended fixes. | It can recommend verification but should not write broad app-side Verified state. |
| `quesiq-study-content-pipeline` | Orchestrate source pack to draft deck to verification to rich CSV import artifact. | Complete handoff set: source pack path, draft JSON, verification JSON, rich CSV, smoke results. | It coordinates the steps; it does not replace human review or production DB checks. |
| `quesiq-dpe-reference-drafter` | Create DPE source-reference packets from reviewed chunks for oral-question/rubric drafting. | `quesiq.dpeReferencePacket.v1` and optional prompt file. | It does not import raw source packs into DPE learner runtime or publish DPE content. |

## Default Study Rich CSV Contract

The Study deck drafter exports rich Admin CSV using these headers:

```text
externalId, deckTitle, deckDescription, subject, audience, question, answer,
hint, level, tags, sourcePackId, sourcePackTitle, sourceChunkIds, sourcePages,
sourceVisualAssetIds, sourceLabel, sourceUrl, sourceNotes, draftId,
draftConfidence, draftWarnings, verificationStatus, verificationConfidence,
verificationNotes, verificationEvidence, verifier
```

Admin Content Studio's Study import defaults should match these headers. If a
CSV uses different column names, the Admin mapping UI should map those columns
back to the same target fields before preview/save.

## PHAK Deck Strategy

PHAK should be treated as a reusable source library first, then deck drafts
second.

- Keep a full PHAK source pack so all cards can cite stable source chunks,
  pages, and useful figures/tables.
- Generate smaller chapter or subject decks for learner use.
- Use tags for source, chapter, subject, certificate relevance, difficulty, and
  content type.
- A full PHAK deck can exist as an umbrella collection, but the import should
  preserve chapter and subject metadata so Study can filter and split it later.
- Use stronger-model Codex drafting and verification for aviation cards.

## Recommended PHAK Prompt

```text
Use quesiq-study-content-pipeline.

Source: <path to reviewed PHAK source pack or generation packet>
Goal: Create a Study deck draft for <chapter or subject>.
Requirements:
- Output study.sourcePackDeckDraft.v1 JSON.
- Preserve sourcePackId, sourceChunkIds, sourcePages, and visual asset ids.
- Add tags for phak, chapter, subject, aviation, and certificate relevance
  when supported by the source.
- Keep each card focused on one testable concept.
- Run source-pack verification and export rich Admin CSV using the default
  QuesIQ Study rich CSV headers.
- Do not mark Publish, Official, or app-side Verified.
```

## Operational Notes

- Source packs and image assets should live outside the app repository, such as
  Google Drive or object storage.
- The app database should store reviewed/imported card data, source metadata,
  verification metadata, and import audit rows, not raw handbook PDFs.
- Local server/browser QA is not required for these skill runs when the local
  server is unavailable.
- DB import/readback checks require `DATABASE_URL` and migrations through the
  Study source/verification metadata migration.
