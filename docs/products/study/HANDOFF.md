# QuesIQ Study Import Handoff

Last updated: 2026-05-29

## Objective

Import the existing Study app from
`C:\Users\weeks\Documents\github\claude_flashcards` into the shared QuesIQ
repository as a separate product lane, without turning it into a separate web
service.

Target shape:

- one Render web service
- shared Auth.js account root
- Study routes under `/study`
- Study code under `src/features/study/`
- Study-owned database tables with `study_` prefixes
- no Study-only fields on the generic Auth.js user table

The current work should be treated as an app import, not a greenfield rebuild.
When deciding the next slice, compare against the source repository first and
port the missing source behavior unless the user explicitly approves a
different product decision.

## Source Repository Inventory

Source repo:
`C:\Users\weeks\Documents\github\claude_flashcards`

Primary source routes and APIs:

- `/`
- `/decks`
- `/decks/new`
- `/decks/[deckId]`
- `/decks/[deckId]/edit`
- `/decks/[deckId]/import`
- `/decks/[deckId]/stats`
- `/decks/[deckId]/study`
- `/decks/[deckId]/study/verbal`
- `/decks/[deckId]/study/written`
- `/decks/[deckId]/study/match`
- `/decks/[deckId]/study/test`
- `/decks/[deckId]/quiz`
- `/library`
- `/api/decks`
- `/api/decks/[deckId]`
- `/api/decks/[deckId]/cards`
- `/api/decks/[deckId]/cards/[cardId]`
- `/api/decks/[deckId]/fork`
- `/api/decks/[deckId]/import`
- `/api/folders`
- `/api/folders/[folderId]`
- `/api/study/[deckId]/rate`
- `/api/study/evaluate`
- `/api/tts`

Important source components and server modules:

- `src/components/flashcards/study-picker.tsx`
- `src/components/flashcards/study-visual.tsx`
- `src/components/flashcards/study-verbal.tsx`
- `src/components/flashcards/study-written.tsx`
- `src/components/flashcards/study-match.tsx`
- `src/components/flashcards/quiz-session.tsx`
- `src/components/flashcards/study-test.tsx`
- `src/components/flashcards/import-wizard.tsx`
- `src/components/flashcards/card-list.tsx`
- `src/components/flashcards/card-editor.tsx`
- `src/components/flashcards/deck-form.tsx`
- `src/components/flashcards/deck-card.tsx`
- `src/components/flashcards/folder-manager.tsx`
- `src/components/flashcards/fork-button.tsx`
- `src/components/flashcards/library-search.tsx`
- `src/components/flashcards/public-toggle.tsx`
- `src/server/decks.ts`
- `src/server/cards.ts`
- `src/server/folders.ts`
- `src/server/import-parser.ts`
- `src/server/library.ts`
- `src/server/srs.ts`
- `src/server/stats.ts`
- `src/server/storage.ts`

Source dependencies that matter for remaining parity:

- `openai`
- `pdf-parse`
- `@aws-sdk/client-s3`

## Current Target Inventory

Target repo:
`C:\Users\weeks\Documents\github\QuesIQ`

Current imported Study routes and APIs:

- `/study`
- `/study/decks`
- `/study/decks/new`
- `/study/decks/[deckId]`
- `/study/decks/[deckId]/edit`
- `/study/decks/[deckId]/import`
- `/study/decks/[deckId]/stats`
- `/study/decks/[deckId]/study`
- `/study/decks/[deckId]/study/verbal`
- `/study/decks/[deckId]/study/written`
- `/study/decks/[deckId]/study/match`
- `/study/decks/[deckId]/study/quiz`
- `/study/decks/[deckId]/study/test`
- `/study/history`
- `/study/library`
- `/api/study/decks`
- `/api/study/decks/[deckId]`
- `/api/study/decks/[deckId]/cards`
- `/api/study/decks/[deckId]/cards/[cardId]`
- `/api/study/decks/[deckId]/fork`
- `/api/study/decks/[deckId]/rate`
- `/api/study/decks/[deckId]/export`
- `/api/study/decks/[deckId]/import`
- `/api/study/evaluate`
- `/api/study/folders`
- `/api/study/folders/[folderId]`
- `/api/study/library`
- `/api/study/tts`

Current imported Study feature files:

- `src/features/study/study-card-list.tsx`
- `src/features/study/study-data.ts`
- `src/features/study/study-deck-card.tsx`
- `src/features/study/study-deck-form.tsx`
- `src/features/study/study-folder-manager.tsx`
- `src/features/study/study-fork-button.tsx`
- `src/features/study/study-home.tsx`
- `src/features/study/study-import-wizard.tsx`
- `src/features/study/study-match.tsx`
- `src/features/study/study-picker.tsx`
- `src/features/study/study-public-toggle.tsx`
- `src/features/study/study-quiz.tsx`
- `src/features/study/study-resume-card.tsx`
- `src/features/study/study-srs.ts`
- `src/features/study/study-test.tsx`
- `src/features/study/study-verbal.tsx`
- `src/features/study/study-visual.tsx`
- `src/features/study/study-written.tsx`

Current Study schema lives in `src/server/db/schema.ts` and includes:

- `study_folders`
- `study_decks`
- `study_cards`
- `study_sessions`
- `study_card_attempts`
- `study_subjects`
- `study_audience_tags`
- `study_trusted_sources`
- `study_deck_audience_tags`
- `study_card_sources`
- `study_verifications`
- `study_deck_imports`

The current Study schema already has several source-compatible card fields:

- `question_audio_url`
- `quiz_mc_audio_url`
- `tf_true_audio_url`
- `tf_false_audio_url`
- `tf_foil_card_id`
- `level`
- verification fields
- exam fields on decks
- folder id on decks

Current Study brand assets live in `public/brand/`:

- `quesiq-icon.png` is the shared QuesIQ icon used across products.
- `quesiq-main-logo.png` is the main platform/product-family logo.
- `quesiq-study-logo.png` is the Study product logo.
- `quesiq-interview-logo.png` remains the Interview product logo.

## Imported And Working

These slices are present in the target repo and were user-confirmed at least at
the visual/UI level during the conversation:

- Study product entry at `/study`
- Study dashboard with user deck stats
- deck list
- deck creation
- deck detail
- deck metadata edit
- manual card add/edit/delete
- basic paste import
- CSV/TSV/TXT upload import with preview and selectable rows
- visual flashcard review
- local visual-session resume support
- SRS-style rating and due/weak card queries
- typed verbal-answer practice
- written-answer practice
- match mode
- quiz mode
- true/false quiz mode
- test mode
- source-style deck-page Study picker
- public library page
- public deck fork/copy
- deck stats page
- cross-deck Study history page
- route parameter parity for `level`, `resume`, `srs`, and honest hands-free
  routing
- hands-free verbal and quiz paths with speech recognition, TTS, and resume
  behavior
- `/api/study/tts` with AI Usage instrumentation
- AI-assisted import from PDF, image, pasted text, and URLs through
  `/api/study/decks/[deckId]/import`
- `/api/study/evaluate`, AI import, and Study TTS AI Usage instrumentation
- folder APIs and folder assignment in deck create/edit
- inline public/private deck toggle
- enriched stats/card-attempt details and inline card edit/delete polish
- Study-prefixed library taxonomy tables and initial library query helpers
- private-owner-only deck export
- test seed and cleanup SQL at `scripts/study/seed_test_decks.sql` and
  `scripts/study/cleanup_test_decks.sql`; generated test decks are marked with
  `[TEST_DELETE]` titles and `__test_delete__` tags
- rich CSV import smoke script at `scripts/study/rich-csv-import-smoke.ts`;
  run with `--parse-only` for parser/source-coverage checks or without
  `--parse-only` after migrations through `0054` are applied for a disposable
  DB save/readback check. DB mode verifies the `0054` metadata columns before
  writing and accepts `--cleanup` to remove the disposable deck after readback.
- local Codex skill `quesiq-study-content-pipeline` coordinates the source
  scrubber, Study deck drafter, Study verifier, rich CSV export, and optional
  import smoke checks for raw source-to-Study import work
- source-style Study folder manager UI on `/study/decks`, including folder
  create, rename, delete, collapse/expand, and per-deck move controls
- deck-first creation surface on `/study/decks` with Manual, Import, AI
  Generate placeholder, and admin-only Official generation entry points
- Study-owned Content Studio flashcard draft primitive at
  `/api/study/content-studio/flashcard-draft`; it returns reviewable deck
  title/description/subject/tags, card drafts with hints/levels/source
  notes/confidence, generation warnings with severity, stable draft id and
  fingerprint, prompt metadata, card counts, low-confidence indexes,
  missing-field flags, review checklist flags, and review sections without
  publishing, marking Official, or marking cards Verified
- Study-owned source-pack deck draft JSON contract and parser at
  `src/server/study/study-source-pack-draft-contract.ts`; it preserves source
  pack id, source chunk ids, page anchors, visual asset ids, tags, verification
  status, and warnings across deck/card draft payloads
- Study-owned generation packet contract and parser at
  `src/server/study/study-generation-packet-contract.ts`; it validates bounded
  `quesiq.studyGenerationPacket.v1` packets targeting
  `study.sourcePackDeckDraft.v1` and preserves source pack metadata, deck
  request metadata, output restrictions, chunk anchors/snippets/tags, and
  related visual ids
- `/api/study/content-studio/flashcard-draft` now includes a side-effect-free
  admin-only `source_pack_preview` mode that validates source-pack-generated
  Study draft JSON and returns review sections without Study runtime writes
- `/api/study/content-studio/flashcard-draft` now also includes side-effect-free
  admin-only `source_pack_generation_packet_preview` mode that validates posted
  generation packets and returns packet review sections without generating
  cards, importing decks, publishing, or writing Official/Verified state
- `src/server/study/study-source-pack-verification-queue.ts` now provides a
  preview-only verification queue contract from a validated
  `study.sourcePackDeckDraft.v1` payload, including source citation coverage,
  warning/status counts, and per-card queued/blocked recommendations
- `/api/study/content-studio/flashcard-draft` now includes side-effect-free
  admin-only `source_pack_verification_queue_preview` mode that validates a
  source-pack draft and returns verifier queue review data only; it does not
  call AI, import Study decks, write cards, publish, or mark Official/Verified
- `src/server/study/study-rich-flashcard-import.ts` now provides a Study-owned
  rich CSV contract/parser for admin imports of AI-generated flashcards with
  source and verification metadata (question/answer/hint/level/tags, source
  pack/chunk/page/visual fields, verification status/confidence/notes/evidence,
  verifier, and draft/external ids)
- `/api/study/content-studio/flashcard-draft` now supports
  `rich_csv_import_preview` (no writes) and `rich_csv_import_save` (admin-only
  target-deck import). Save writes cards plus `study_card_sources`,
  `study_verifications`, and `study_deck_imports` metadata while keeping
  Publish/Official controls disabled and keeping conservative Verified policy
  checks (status must be `verified`, confidence >= 0.8, verifier present)
- `drizzle/0054_add_study_source_verification_metadata.sql` adds structured
  metadata storage for rich admin imports: `study_card_sources.source_metadata`
  and `study_verifications.verification_status`, `evidence`, and `verifier`.
  Study card review surfaces these source/verification details instead of
  requiring reviewers to infer all context from packed label/note text.
- source-style import wizard polish for focus hints, URL failure display,
  CSV/Quizlet/Anki guidance, select/deselect review controls, column swapping,
  row/URL counts, and save/done copy
- source-style Study TTS object-storage caching path for R2 when the R2 env
  vars are configured; `/api/study/tts` keeps AI Usage instrumentation and
  returns generated audio directly if cache read/write fails
- source-style verbal/quiz polish for spoken verbal self-rating, rating
  countdown default, quiz feedback TTS, stable quiz answer ordering, and quiz
  TTS cache keys for question/MC/true-false audio
- card list/status polish for Study card mastery, due, weak/new state, level,
  verification, and ease display
- Study app shell, menus, pill controls, segmented controls, focus states, and
  logos now follow the same shared display rules used by QuesIQ Interview.
- `0049_seed_study_library_taxonomy.sql` seeds the imported source subject and
  audience taxonomy content, including parent/child/grandchild subject order.
- Study now has a product-owned XP/quest slice with `study_progression_events`,
  `study_xp_rules`, `study_quests`, `study_user_progression`, and
  `study_user_quests` tables seeded by `0052_add_study_progression.sql`
- Study rate events now award idempotent XP by card-attempt id, sync Study
  quest progress, and rebuild a Study-owned progression summary
- `/study` now includes a Study momentum panel with level, XP progress,
  accuracy, and quest progress preview

Latest known full code verification before this handoff:

- `npm run lint`
- `npm run typecheck`
- `npm run build`

Those checks passed after the Study brand/platform logo updates on 2026-05-29.

## Known Divergences From Source

These are places where the target repo strayed from a strict copy of
`claude_flashcards`.

1. Deck export was added in the target repo, but it is not part of the source
   app inventory. The user allowed it to remain only if restricted. Current
   target behavior restricts export to signed-in owners and blocks public or
   official deck export.

2. `/study/history` was added as a platform-style cross-deck history page. It
   does not appear in the source route inventory.

3. The prior `/study/decks/[deckId]/start` intermediate launcher route was
   removed. Study launch now uses the source-style deck-page picker directly.

4. `/study/library` keeps target-only V1 library filters as a product decision.
   It separates ownership/visibility (`Public`, `Mine`) from trust/source
   status (`Official`, `Verified`). It now has Study-prefixed taxonomy tables,
   `getStudyRootSubjects`, `getStudyAudienceTags`, `getStudyLibraryDecks`,
   mapped audience-tag filtering, and mobile-friendly pill filters. It is still
   a target-side implementation rather than a literal copy of source
   `LibrarySearch`, so final mobile visual QA is still useful.

5. The target import wizard supports AI-assisted import and CSV/TSV/TXT flows,
   plus the source-style focus hints, URL failure display, CSV/Quizlet/Anki
   guidance, selectable review rows, column swapping, and save/done copy.

6. The target verbal mode now has hands-free, speech recognition, TTS, resume,
   SRS behavior, spoken self-rating, rating countdown, missed-card requeueing,
   and source-style verbal polish.

7. The target quiz mode now has normal and hands-free play, TTS, true/false,
   feedback TTS, stable answer ordering, missed-card requeueing, audio
   prefetching, and R2-backed TTS cache keys when object-storage env vars are
   configured.

8. Study OpenAI calls are now instrumented for Admin AI Usage with
   `study_evaluate`, `study_import`, and `study_tts` run types. Model/prompt
   choices can still be revisited against the source app and platform prompt
   config direction. The V1 deck verification action records its AI usage under
   `study_evaluate` with `operation: study_deck_verification` metadata rather
   than adding a new shared run type.

9. Source has a richer folder-management component. Target now has a
   Study-native folder manager on `/study/decks` with the source create,
   rename, delete, collapse, and move-to-folder behavior.

10. Source has richer public-library taxonomy behavior and metadata. Target has
    the Study-prefixed taxonomy tables, mapped audience-tag filtering, and
    source taxonomy seed migration. V1 also has an admin-only AI verification
    pass that updates card-level verification fields and deck verified-card
    counts. Real official/library content curation is still needed beyond test
    data and taxonomy labels.

11. Source `/api/tts` includes object-storage caching via `src/server/storage.ts`.
    Target `/api/study/tts` now has Study-namespaced R2/object-storage caching
    when `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
    `R2_BUCKET_NAME`, and `R2_PUBLIC_URL` are configured.

12. Target-only additions deliberately kept: `/study/history`, private
    owner-only export, and V1 library visibility/trust filters. The prior
    `/study/decks/[deckId]/start` launcher was removed.

13. Study progression is now product-owned in Study-prefixed tables and wired
    only to Study rate attempts. It does not reuse Interview progression
    tables, and it currently awards XP from card-rating events rather than a
    broader Study event set.

## Current Functional Gaps To Fix

These are the remaining practical gaps after the broad Study import passes.

1. Test data is needed to verify taxonomy filtering end-to-end. Use
   `scripts/study/seed_test_decks.sql` after migrations through `0049` are
   applied. Use `scripts/study/cleanup_test_decks.sql` to delete the generated
   decks afterward.

2. Migration/seed QA still needs a database with `DATABASE_URL` configured.
   Local `npm run db:migrate` was attempted on 2026-05-29 but could not run
   because `DATABASE_URL` was not configured in this workspace.

3. Permission and production QA still needs deployed or local signed-in and
   signed-out browser checks after migrations and seed data are available.

4. R2/object-storage audio caching is coded, but production caching depends on
   `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
   `R2_BUCKET_NAME`, and `R2_PUBLIC_URL`. Without those env vars, Study TTS
   still works by returning generated audio directly without persistence.

5. Visual/mobile QA is still needed on the deployed app. The in-app browser
   runtime failed in the local Windows sandbox during the last pass, so code
   verification passed but a screenshot/browser pass was not completed.

6. Real Study library content curation remains. The taxonomy labels are seeded,
   and QA seed decks exist, but production official decks/content are not
   curated as part of this port.

7. Study progression v1 is intentionally narrow. It currently awards XP only on
   Study card-rating attempts and ships a small starter quest/rule set.
   Additional Study-only milestones (due-queue clears, verified-card goals,
   subject depth) are future expansion work.

8. Reviewed source-pack content now has a draft-JSON contract and preview path,
   but no direct runtime import. The intended flow is reviewed chunks/assets ->
   generation packet -> draft JSON -> admin review/verifier -> later approved
   Study import.

## Remaining Port Slices

Recommended order from least risky/confusing to largest:

1. Migration and seed QA.
   Apply migrations through `0049_seed_study_library_taxonomy.sql`, then run
   `scripts/study/seed_test_decks.sql` against the target database. Verify
   `/study/library` filters by subject, text tags, and mapped audience tags.
   Run `scripts/study/cleanup_test_decks.sql` after QA.

2. Permission and production QA.
   Re-run library/fork/export/deck/card permission checks after migrations and
   seed data exist: private decks stay private, official decks are not
   exportable, public deck copy works, owners edit only their content, and
   signed-out users see only public library content.

3. R2 config QA.
   Configure the R2 env vars in production if cached generated audio should be
   retained. Verify `/api/study/tts` returns a cached `audioUrl` after first
   generation and keeps direct audio fallback behavior if cache writes fail.

4. Visual/mobile QA.
   On production or a local browser with auth available, verify `/study`,
   `/study/decks`, `/study/library`, deck detail, import, Study picker, folder
   manager, and the study modes on mobile and desktop.

5. Library content curation.
   Add or import real official/public Study library decks after permission and
   taxonomy QA passes.

6. Study progression v1 tuning.
   Validate XP pace and quest thresholds with real usage, then expand
   Study-only events and quests if needed (for example due-queue and
   verified-card milestones).

## Recommended Next Slice

Run migration/seed QA for the Study library taxonomy path next in an environment
with `DATABASE_URL` configured.

Reason: the code now has taxonomy tables, mapped audience-tag filtering, and
test deck SQL, but this path needs real database rows to verify end-to-end.

Minimum acceptance for that slice:

- migrations apply through `0049_seed_study_library_taxonomy.sql`
- `scripts/study/seed_test_decks.sql` creates three `[TEST_DELETE]` public decks
  with three cards each
- `/study/library?tag=Beginner` returns the Algebra and US Capitals test decks
- `/study/library?tag=Quick+Review` returns the Algebra and STAR test decks
- `/study/library?tag=Interview+Prep` returns the STAR test deck
- `scripts/study/cleanup_test_decks.sql` removes the seeded decks

## Handoff Rules For The Next Agent

- Start with `docs/README.md`, `docs/rebuild/HANDOFF.md`,
  `docs/rebuild/CURRENT_STATUS.md`, `docs/rebuild/PLATFORM_READINESS.md`, and
  this file.
- Treat `claude_flashcards` as the Study source of truth for import behavior.
- Do not recreate source features from memory when the source file can be read.
- Keep target routes under `/study` and APIs under `/api/study` unless there is
  a deliberate platform reason not to.
- Keep product data in `study_*` tables.
- Do not add product-specific fields to Auth.js `user`.
- Before adding or keeping a non-source feature, mark it as a product decision
  in this handoff or `docs/products/study/README.md`.
- Any OpenAI call in Study must include Admin AI Usage instrumentation in the
  same slice.
- After runtime code changes, run `npm run lint`, `npm run typecheck`, and
  `npm run build` before handing back unless a blocker is documented.
