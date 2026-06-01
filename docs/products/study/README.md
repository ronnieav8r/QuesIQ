# QuesIQ Study

QuesIQ Study should be imported as a separate product lane inside the shared
QuesIQ platform, not as a separate service by default.

## Target Lane

Use:

- `src/features/study/`
- product-owned routes under the future app product route structure
- Study-specific database tables keyed by shared Auth.js `user.id`

## Current Import Status

The first Study slice is imported:

- `/study` renders a real Study dashboard from `src/features/study/study-home.tsx`
- `/study/decks`, `/study/decks/new`, and `/study/decks/[deckId]` support the
  deck-first management slice; `/study/decks` is now the creation hub for
  manual decks, imports, future AI generation, and admin official generation
- `/study/decks/[deckId]/edit` supports deck metadata updates
- `/study/decks/[deckId]/import` supports dependency-free pasted text/CSV card
  import
- `/study/decks/[deckId]/study` supports the first visual flashcard review mode
- `/study/decks/[deckId]/study/verbal` supports typed verbal-answer practice
  with AI verdict/feedback and saved Study attempts
- `/study/decks/[deckId]/study/written` supports typed written-answer practice
  with AI feedback plus self-rating overrides for SRS scheduling
- `/study/decks/[deckId]/study/match` supports term-definition matching rounds
  that write SRS-aligned attempt ratings
- `/study/decks/[deckId]/study/quiz` supports multiple-choice quiz rounds with
  persisted score ratings
- `/study/decks/[deckId]/study/quiz?mode=truefalse` supports true/false rounds
  with persisted score ratings
- `/study/decks/[deckId]/study/test` supports full test runs with detailed
  per-question end-of-test review
- deck pages now include the source-style inline Study picker (preset filters,
  modality selection, mode cards, honest hands-free routing, optional SRS,
  resume, and level routing)
- `/study/decks/[deckId]/stats` shows deck-level study session totals, mode mix,
  card health, card-attempt details, and recent session outcomes for the owner
- public deck pages now support signed-in `Save Copy`, cloning a deck and its
  cards into the user's private Study lane
- `/study/history` shows cross-deck recent study sessions with mode, accuracy,
  quick deck links, and server-side deck/mode filters
- `/study/decks/[deckId]/import` now supports CSV/TSV/TXT file upload in
  addition to pasted card text, with selectable preview rows before save and
  downloadable CSV/TSV templates; import parsing skips header rows and exact
  duplicate question/answer lines
- `/study/decks/[deckId]/import` also supports AI-assisted import from PDF,
  images, pasted text, and URLs through `/api/study/decks/[deckId]/import`
- owned deck pages now support `Export CSV` and `Export TSV` through
  `/api/study/decks/[deckId]/export`
- `/study/library` shows public Study decks and the signed-in user's owned
  decks with search, subject filter, ownership/visibility filters (`Public`,
  `Mine`), and trust/source filters (`Official`, `Verified`) backed by
  Study-prefixed taxonomy tables for subjects, audience tags, sources,
  verifications, and deck imports; subject and audience filters now use
  mobile-friendly pill controls
- admin users can run a lightweight AI verification pass from a deck page; the
  pass marks individual cards verified only when the model returns high
  confidence and no substantive factual or safety issue, updates the deck
  verified-card count, and records Study AI usage as `study_evaluate`
- `/api/study/content-studio/flashcard-draft` provides a Study-owned
  Content Studio primitive for reviewable flashcard deck drafts. It accepts
  source text and prompt instructions, returns deck metadata plus generated
  card drafts with source notes/confidence/warnings, stable draft id and
  fingerprint, prompt metadata, card counts, missing-field flags, low-confidence
  indexes, review checklist flags, and review sections; it never publishes,
  marks Official, or marks cards Verified.
- `src/server/study/study-source-pack-draft-contract.ts` now defines and
  validates a Study-owned source-pack deck draft JSON contract for Content
  Studio. The contract preserves source pack id, source chunk ids, page
  anchors, visual asset ids, tags, verification status, and warnings for each
  card/deck.
- `src/server/study/study-generation-packet-contract.ts` now defines and
  validates bounded generation packets with
  `packetVersion=quesiq.studyGenerationPacket.v1` and
  `targetContract=study.sourcePackDeckDraft.v1`. The packet parser preserves
  source pack id/title/page range, deck request title/subject/card target,
  output restrictions, chunk ids, page anchors, text snippets, tags, and
  related visual ids.
- `/api/study/content-studio/flashcard-draft` now supports an admin-only
  `source_pack_preview` mode that validates source-pack-generated draft JSON and
  returns review sections. This preview mode is side-effect-free and does not
  write Study runtime content.
- `/api/study/content-studio/flashcard-draft` also supports admin-only
  `source_pack_generation_packet_preview` mode. It validates a posted
  generation packet and returns preview/review sections only; it does not
  generate cards, import decks, publish, or write Official/Verified state.
- `src/server/study/study-source-pack-verification-queue.ts` builds a
  preview-only verifier queue packet from a validated
  `study.sourcePackDeckDraft.v1` payload. It summarizes card counts, status
  counts, source citation coverage, visual coverage, warning counts, and
  per-card queue recommendations.
- `/api/study/content-studio/flashcard-draft` supports admin-only
  `source_pack_verification_queue_preview` mode. It validates
  `sourcePackDraftJson` using the existing Study draft parser, returns the
  queue preview and review sections, and does not call AI, import decks, write
  cards, publish, or mark Official/Verified.
- `src/server/study/study-rich-flashcard-import.ts` defines a stable rich CSV
  admin import contract for AI-generated Study flashcards with source and
  verification metadata. It exports required headers, parses CSV/TSV
  deterministically (including quoted CSV cells), normalizes list fields,
  and returns row-level validation warnings/errors.
- Rich CSV parser now supports flexible `columnMapping` for arbitrary CSV
  source headers while preserving the default Codex skill export contract.
  `STUDY_RICH_IMPORT_DEFAULT_COLUMN_MAPPING` maps the expected target fields to
  canonical rich import headers, including deck title/description, subject,
  audience, source-pack title/notes, draft confidence/warnings, and verifier
  fields. When no mapping is sent, the default skill-export headers are used.
- `/api/study/content-studio/flashcard-draft` now supports
  `rich_csv_import_preview` and `rich_csv_import_save` for admin/developer
  import workflows. Preview returns normalized rows and validation summaries
  without writes. Save imports cards plus `study_card_sources`,
  `study_verifications`, and `study_deck_imports` metadata for a target deck.
  Save can create a new Study deck from Admin request fields or from the first
  parsed row's mapped `deckTitle`, `deckDescription`, `subject`, and `tags`
  values. This is still separate from Publish/Official controls and broad
  Verified promotion.
- `rich_csv_import_preview` and `rich_csv_import_save` accept optional
  `columnMapping` (`{ [targetField]: sourceHeader }`) and both use the same
  parser normalization path. Preview returns detected CSV headers, supported
  target fields, effective mapping, and unmapped required fields.
- Rich CSV import also accepts the current Study test-bed CSV schema with
  `shortAnswer`, `explanation`, `officialReference`, `officialReferenceUrl`,
  `additionalReferences`, `additionalReferenceUrls`, and optional
  `official`/`verified` booleans without requiring explicit column mapping.
  Rows with `officialReference`/`officialReferenceUrl` infer Official deck
  import intent unless an explicit `official` value is provided.
- `drizzle/0054_add_study_source_verification_metadata.sql` adds structured
  source metadata and verification status/evidence/verifier fields so rich CSV
  imports do not have to preserve chunk/page/visual details only inside labels
  or notes. Deck cards surface this evidence in an expandable source and
  verification section.
- `/api/study/tts` supports Study voice paths with Admin AI Usage
  instrumentation and source-style R2 audio caching when R2 environment
  variables are configured
- `/api/study/folders` and `/api/study/folders/[folderId]` support Study folder
  management data, with deck create/edit assignment and a source-style folder
  manager on `/study/decks`
- Study uses the shared QuesIQ product shell, Interview-aligned tokens and
  controls, the shared QuesIQ icon, and its own `quesiq-study-logo.png` product
  logo. The platform selector uses `quesiq-main-logo.png`.
- `/study` now uses an Interview-style Study navigation shell with Home, Decks,
  New, Library, and History links. The menu appears as a left rail on desktop,
  a bottom bar on mobile, and can be collapsed with local preference storage.
- owned deck pages include an inline public/private toggle
- signed-in users can create/edit decks, add/delete cards manually, and review
  cards with simple recall ratings; card lists now support inline edit/delete
- Study reuses the shared platform Auth.js session
- baseline Study deck/card/session, folder, and library taxonomy tables are
  added with `study_` prefixes
- Study now has product-owned progression storage and helpers using
  `study_progression_events`, `study_xp_rules`, `study_quests`,
  `study_user_progression`, and `study_user_quests`
- Study card rating now awards idempotent XP by attempt id, syncs quest
  progress, and rebuilds a Study-owned progression summary
- `/study` now includes a Study momentum panel with level, XP-to-next-level,
  accuracy, and quest progress preview
- temporary library QA seed scripts live at
  `scripts/study/seed_test_decks.sql` and
  `scripts/study/cleanup_test_decks.sql`; generated decks are marked with
  `[TEST_DELETE]` and `__test_delete__`
- rich admin CSV import smoke coverage is available with
  `node_modules/.bin/tsx scripts/study/rich-csv-import-smoke.ts --parse-only`
  for parser/source-coverage verification, or without `--parse-only` after
  `DATABASE_URL` and migrations through `0054` are available for a disposable
  `[TEST_DELETE]` DB save/readback check. DB mode verifies the `0054` metadata
  columns before writing and accepts `--cleanup` to remove the disposable deck
  after readback.
- `rich_csv_import_save` remains admin-only and can mark a deck Official only
  through this import path (`markDeckOfficial` or row-level `official=true`);
  card `isVerified` remains conservative and is only set true when verified
  status plus confidence/verifier policy are satisfied.
- local Codex skill `quesiq-study-content-pipeline` coordinates the source
  scrubber, Study deck drafter, Study verifier, rich CSV export, and optional
  import smoke checks for raw source-to-Study import work
- `0049_seed_study_library_taxonomy.sql` seeds the imported source taxonomy
  labels for subjects and audience tags
- remaining work is mostly migration/seed QA, production permission QA, R2 env
  verification, mobile visual QA, Study progression tuning/quest expansion, and
  real library content curation

Detailed import parity, divergence, and remaining-slice notes live in
`docs/products/study/HANDOFF.md`.

## V1 Readiness (Static, Non-Voice)

For pre-QA checks that do not require browser automation, DB writes, or voice
hardware, run:

- `node scripts/study/readiness-check.mjs`
- `node_modules/.bin/tsx scripts/study/rich-csv-import-smoke.ts --parse-only`

Readiness check behavior:

- reports pass/warn/fail counts for Study route/API/module presence and
  import/preview/save boundaries
- exits nonzero only for blocker-level failures
- treats missing `DATABASE_URL`, R2, and OpenAI env vars as warnings only
  (local runs remain valid)

V1 readiness for this lane means:

- Study Content Studio import contract paths are present and admin-gated
- rich CSV default headers/mapping/parser and parse-only smoke path are present
- source/verification metadata and source-pack preview/save scaffolding are
  statically detectable
- Publish, Official, and broad Verified promotion remain disabled

## Boundaries

Study should not add Study-only fields to the generic Auth.js user table.

Study owns its own:

- study content model
- study sessions or attempts
- progress records
- Study prompts/AI calls
- Study-specific admin views

Shared platform owns auth, account, product selection, billing when added, and
common shell behavior.

## Future Source-Pack Import Path

Study should not ingest raw source-pack files directly into learner runtime.
The intended path is:

1. reviewed source-pack chunks/assets produce bounded generation packet JSON
2. generation packet maps to `study.sourcePackDeckDraft.v1` draft JSON
3. Admin Content Studio review plus verifier checks
4. later approved Study import step (separate from generation/preview)

The current contract/preview layer intentionally stops before publish, Official,
Verified, or Study library/runtime writes.
