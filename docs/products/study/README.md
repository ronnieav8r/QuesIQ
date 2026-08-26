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
- `/study/decks/[deckId]/study/memorize` supports passive listening review:
  Que reads each prompt and answer aloud without scoring or changing SRS
  progress
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
- `/admin?product=study` includes the standard Study CSV Import tool for admin
  deck imports. It previews the rich CSV, shows detected headers, lets admins
  map incoming columns to Study fields, marks the imported deck Public/Official,
  and optionally adds the imported deck to an existing or new deck stack.
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
- `/api/admin/study/rich-csv-import` supports `preview` and `save` modes for
  admin import workflows. Preview returns normalized rows and validation
  summaries without writes. Save imports cards plus `study_card_sources`,
  `study_verifications`, and `study_deck_imports` metadata, can create a new
  Study deck, can mark that deck Public/Official, and can attach the deck to a
  stack.
- The rich CSV import API accepts optional `columnMapping`
  (`{ [targetField]: sourceHeader }`) and uses the same parser normalization
  path for preview/save. Preview returns detected CSV headers, supported target
  fields, effective mapping, and unmapped required fields.
- Rich CSV import also accepts the official content CSV schema with
  `shortAnswer`, `explanation`, `officialReference`, `officialReferenceUrl`,
  `additionalReferenceLabels`, `additionalReferenceUrls`, `referenceNote`, and optional
  `official`/`verified` booleans without requiring explicit column mapping.
  Rows with `officialReference`/`officialReferenceUrl` infer Official deck
  import intent unless an explicit `official` value is provided.
- `drizzle/0080_add_study_card_explanations.sql` adds a dedicated
  learner-facing `study_cards.explanation` field. Expanded explanations should
  never be forced into `hint`, `sourceNotes`, or verification metadata.
- `drizzle/0086_add_study_canonical_import_model.sql` adds the canonical Study
  import model: `study_canonical_cards`, `study_deck_card_memberships`, and
  `study_cards.canonical_card_id`. This lets official content packets store one
  canonical fact while still materializing deck-facing cards for the current
  Study UI.
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
- `/study/stacks`, `/study/stacks/new`, and `/study/stacks/[stackId]` support
  Study Deck Stacks: curated ordered groups of multiple decks for learning
  paths, curricula, and exam sequences. Stacks are separate from folders and
  tags: folders remain private loose organization, tags remain metadata, and
  stacks are intentional deck paths that can be private or public.
- `/api/study/stacks`, `/api/study/stacks/[stackId]`, and
  `/api/study/stacks/[stackId]/items` support stack list/detail,
  create/update/delete for owned stacks, and add/remove/reorder deck items.
  A deck can belong to multiple stacks; stack items preserve `sort_order`.
- `drizzle/0079_add_study_deck_stacks.sql` adds `study_deck_stacks` and
  `study_deck_stack_items` with owner/public/official metadata, ordered deck
  items, indexes, and cascade cleanup when stacks or decks are deleted.
- Study uses the shared QuesIQ product shell, Interview-aligned tokens and
  controls, the shared QuesIQ icon, and its own `quesiq-study-logo.png` product
  logo. The platform selector uses `quesiq-main-logo.png`.
- `/study` now uses an Interview-style Study navigation shell with Home, Decks,
  New, Stacks, Library, and History links. The menu appears as a left rail on
  desktop, a bottom bar on mobile, and can be collapsed with local preference
  storage.
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
  `[TEST_DELETE]` DB save/readback check. DB mode verifies the rich-import
  columns before writing and accepts `--cleanup` to remove the disposable deck
  after readback.
- model-backed Study answer-evaluator smoke coverage is available with
  `npm run smoke:study` after local Postgres, migrations, and an accepted test
  key are configured. It creates a disposable deck/card, calls the same backend
  `study_answer_evaluator_v1` helper used by `/api/study/evaluate`, records
  `study_evaluate` usage in `ai_runs`, persists a Study attempt, and cleans up
  disposable rows. The smoke accepts `OPENAI_STUDY_TEST_TUNNEL_API_KEY`,
  `OPENAI_INTERVIEW_TEST_TUNNEL_API_KEY`, `OPENAI_STUDY_API_KEY`, or
  `OPENAI_API_KEY`, without printing secrets.
- canonical Study packet import coverage is available with
  `npm run study:import-canonical -- --dry-run`.
  The canonical importer reads a canonical card CSV plus a deck-membership CSV,
  validates canonical IDs, deck memberships, Official/Verified fields, source
  evidence, and expert-review boundaries, then upserts canonical cards, decks,
  deck-facing cards, memberships, source rows, and verification rows. Run
  without `--dry-run` only after migrations through `0086` are applied.
- The promoted A&P/TEAS/HESI canonical healthcare packet was imported into the
  local DB on 2026-06-21 using the canonical importer: 1,935 canonical cards,
  1,961 deck memberships, 40 public/official decks, all imported deck-facing
  cards linked to canonical cards and marked Verified, and zero expert-reviewed
  claims. No production import was performed in that slice.
  Canonical packets use the content-manager S12 promotion report as the
  Official/Verified authority; the rich CSV confidence/verifier rule below is
  for flat rich CSV imports.
- `rich_csv_import_save` remains admin-only and can mark a deck Official only
  through this import path (`markDeckOfficial` or row-level `official=true`);
  card `isVerified` remains conservative and is only set true when verified
  status plus confidence/verifier policy are satisfied.
- The preferred admin import endpoint is
  `/api/admin/study/rich-csv-import`. Use `mode=preview` to validate/match
  headers and `mode=save` to create or update a deck, mark the deck
  Public/Official, and attach the imported deck to a stack.

### Admin Rich CSV Format

Use this header row for Study admin imports:

```text
externalId,deckTitle,deckDescription,industry,role,certification,examOrStandard,version,subject,topic,audience,question,answer,explanation,hint,level,tags,sourceLabel,sourceUrl,additionalReferenceLabels,additionalReferenceUrls,referenceNote,sourcePackId,sourcePackTitle,sourceChunkIds,sourcePages,sourceVisualAssetIds,sourceNotes,draftId,draftConfidence,draftWarnings,verificationStatus,verificationConfidence,verificationNotes,verificationEvidence,verifier,isOfficial,isVerified,expertReviewStatus,expertReviewType,expertReviewer,expertReviewDate,expertReviewNotes
```

Required fields:

- `question`
- `answer`

Operational fields:

- `answer` should be the short memory target; `explanation` is the expanded
  learner-facing context shown after the answer.
- `sourceLabel`/`sourceUrl` are the primary source shown to learners.
  `additionalReferenceLabels` and `additionalReferenceUrls` are
  pipe-separated supporting references. `referenceNote` is learner-visible.
- `sourceNotes`, `draftWarnings`, `verificationNotes`, and
  `verificationEvidence` are internal/admin metadata and should not be used as
  the learner explanation.
- `isOfficial=true` marks the imported deck Official, or admins can use the
  Study Admin checkbox.
- `isVerified=true` is source/fact verification only. It is not expert review.
  A card is only marked Verified when the CSV explicitly sets
  `isVerified=true`, `verificationStatus=verified`,
  `verificationConfidence >= 0.8`, and `verifier` is present.
  Canonical Study packets are imported through the canonical importer instead;
  for those packets, the S12 promotion report is the app-side Verified source
  of truth.
- `expertReviewStatus` is a separate human/expert review layer. It accepts
  `not_required`, `needs_expert_review`, `expert_reviewed`, or `rejected`.
  Do not use `isVerified=true` as a substitute for expert review.
- `expertReviewType` identifies the review lane, such as `clinical`,
  `flight_instructor`, `broker`, `legal`, or `finance`.
  `expertReviewer`, `expertReviewDate`, and `expertReviewNotes` preserve the
  human signoff metadata.
- list fields such as `tags`, `sourceChunkIds`, `sourcePages`,
  `sourceVisualAssetIds`, `additionalReferenceLabels`,
  `additionalReferenceUrls`, `draftWarnings`, and `verificationEvidence` may
  use `|`, `;`, `,`, or JSON arrays.
- `level` accepts `beginner`, `intermediate`, or `advanced`.
- `verificationStatus` accepts `blocked`, `needs_review`,
  `ready_for_verifier`, `unverified`, or `verified`.

Minimal official deck import example:

```csv
deckTitle,subject,question,answer,explanation,hint,level,tags,sourceLabel,sourceUrl,isOfficial
Private Pilot Airplane - Weather,Private Pilot,What is a METAR?,A routine aviation weather report.,METARs report observed weather at an airport and are used for preflight weather awareness.,Think current observed weather.,beginner,weather|metar,FAA Aviation Weather Handbook,https://www.faa.gov/regulations_policies/handbooks_manuals/aviation,true
```

Verified source-backed example:

```csv
deckTitle,subject,question,answer,sourceLabel,sourceUrl,verificationStatus,verificationConfidence,verificationEvidence,verifier,isOfficial,isVerified,expertReviewStatus,expertReviewType
Private Pilot Airplane - Weather,Private Pilot,What is a METAR?,A routine aviation weather report.,FAA PHAK,https://example.com,verified,0.91,PHAK weather reference,admin_reviewer,true,true,needs_expert_review,flight_instructor
```
- local Codex skill `quesiq-study-content-pipeline` coordinates the source
  scrubber, Study deck drafter, Study verifier, rich CSV export, and optional
  import smoke checks for raw source-to-Study import work
- `0049_seed_study_library_taxonomy.sql` seeds the imported source taxonomy
  labels for subjects and audience tags
- remaining work is mostly large-stack performance optimization for the
  imported healthcare stack, production import/release planning, production
  permission QA, R2 env verification, mobile visual QA, and Study progression
  tuning/quest expansion

Detailed import parity, divergence, and remaining-slice notes live in
`docs/products/study/HANDOFF.md`.

## V1 Readiness (Static, Non-Voice)

For pre-QA checks that do not require browser automation, DB writes, or voice
hardware, run:

- `node scripts/study/readiness-check.mjs`
- `node_modules/.bin/tsx scripts/study/rich-csv-import-smoke.ts --parse-only`
- `npm run smoke:study` when local Postgres/migrations and an accepted test key
  are available

Readiness check behavior:

- reports pass/warn/fail counts for Study route/API/module presence and
  import/preview/save boundaries
- exits nonzero only for blocker-level failures
- treats missing `DATABASE_URL`, R2, and OpenAI env vars as warnings only
  (local runs remain valid)

V1 readiness for this lane means:

- Study Admin CSV import is present, admin-gated, and exposes header mapping
  plus deck Official/stack assignment controls
- rich CSV default headers/mapping/parser and parse-only smoke path are present
- source/verification metadata and source-pack preview/save scaffolding are
  statically detectable
- Study answer evaluator smoke coverage is present, model-key gated, and cleans
  up disposable DB rows
- Publish remains separately gated. Broad ad hoc Official/Verified promotion is
  disabled, but S12-promoted canonical packets can be imported Official/Verified
  through the canonical importer.

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
3. source review plus verifier checks
4. Study Admin CSV import through `/admin?product=study`

The current source-pack contract/preview layer intentionally stops before
publish or Study library/runtime writes. Official/Verified writes require either
the admin rich CSV save path or the S12-promoted canonical importer path.
