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
  card drafts with source notes/confidence/warnings, and never publishes,
  marks Official, or marks cards Verified.
- `/api/study/tts` supports Study voice paths with Admin AI Usage
  instrumentation and source-style R2 audio caching when R2 environment
  variables are configured
- `/api/study/folders` and `/api/study/folders/[folderId]` support Study folder
  management data, with deck create/edit assignment and a source-style folder
  manager on `/study/decks`
- Study uses the shared QuesIQ product shell, Interview-aligned tokens and
  controls, the shared QuesIQ icon, and its own `quesiq-study-logo.png` product
  logo. The platform selector uses `quesiq-main-logo.png`.
- owned deck pages include an inline public/private toggle
- signed-in users can create/edit decks, add/delete cards manually, and review
  cards with simple recall ratings; card lists now support inline edit/delete
- Study reuses the shared platform Auth.js session
- baseline Study deck/card/session, folder, and library taxonomy tables are
  added with `study_` prefixes
- temporary library QA seed scripts live at
  `scripts/study/seed_test_decks.sql` and
  `scripts/study/cleanup_test_decks.sql`; generated decks are marked with
  `[TEST_DELETE]` and `__test_delete__`
- `0049_seed_study_library_taxonomy.sql` seeds the imported source taxonomy
  labels for subjects and audience tags
- remaining work is mostly migration/seed QA, production permission QA, R2 env
  verification, mobile visual QA, and real library content curation

Detailed import parity, divergence, and remaining-slice notes live in
`docs/products/study/HANDOFF.md`.

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
