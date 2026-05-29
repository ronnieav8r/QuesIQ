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
- `/study/decks/[deckId]/start`
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
- `/api/study/evaluate`
- `/api/study/library`

Current imported Study feature files:

- `src/features/study/study-card-list.tsx`
- `src/features/study/study-data.ts`
- `src/features/study/study-deck-card.tsx`
- `src/features/study/study-deck-form.tsx`
- `src/features/study/study-fork-button.tsx`
- `src/features/study/study-home.tsx`
- `src/features/study/study-import-wizard.tsx`
- `src/features/study/study-match.tsx`
- `src/features/study/study-picker.tsx`
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

Latest known full code verification before this handoff:

- `npm run lint`
- `npm run typecheck`
- `npm run build`

Those checks passed after the source-style Study picker and private-only export
restriction were added. This handoff is documentation-only and does not change
runtime code.

## Known Divergences From Source

These are places where the target repo strayed from a strict copy of
`claude_flashcards`.

1. Deck export was added in the target repo, but it is not part of the source
   app inventory. The user allowed it to remain only if restricted. Current
   target behavior restricts export to signed-in owners and blocks public or
   official deck export.

2. `/study/history` was added as a platform-style cross-deck history page. It
   does not appear in the source route inventory.

3. `/study/decks/[deckId]/start` was added as an intermediate launcher before
   the source-style Study picker was imported. The source app uses the deck page
   picker directly. This target route may be redundant.

4. `/study/library` uses a simpler target-side search/filter implementation
   plus a `scope` filter. Source uses `LibrarySearch`, `getRootSubjects`,
   `getAudienceTags`, and `getLibraryDecks` with subject/tag taxonomy support.

5. The target import wizard currently handles dependency-free paste and
   CSV/TSV/TXT upload. Source also supports AI-assisted import from PDF, image,
   pasted text, and URLs through `/api/decks/[deckId]/import`.

6. The target typed verbal mode is simplified. Source verbal mode supports
   manual and hands-free modes, speech recognition, silence timing, device TTS,
   optional OpenAI TTS, rating recognition, resume, and SRS.

7. The target quiz mode is simplified. Source quiz uses `quiz-session.tsx` with
   normal and hands-free play, speech recognition, device TTS, OpenAI TTS, R2
   audio caching, multiple-choice audio, true/false audio, and prefetching.

8. The target `/api/study/evaluate` uses a direct `fetch` call to OpenAI
   Chat Completions with `gpt-4o-mini`. Source uses the OpenAI SDK with
   `gpt-4o`. The broader QuesIQ app direction says new OpenAI calls should use
   Admin AI Usage instrumentation, and preferably the current app-owned AI run
   pattern. This target endpoint is not instrumented yet.

9. Source has folder management UI and folder API routes. Target has the schema
   field but does not yet expose folder management in the Study lane.

10. Source has `PublicToggle` on the deck detail page. Target supports changing
    `isPublic` through deck edit, but does not yet have the same quick toggle
    UX.

11. Source has richer public-library taxonomy tables:
    `subjects`, `audience_tags`, `trusted_sources`, `deck_audience_tags`,
    `card_sources`, `verifications`, and `deck_imports`. Target Study has not
    imported the Study-prefixed equivalents yet.

12. Source `/api/tts` and `src/server/storage.ts` are not imported. Target
    schema has audio URL columns, but no Study TTS route or R2 storage helper.

13. Source route params include `level`, `hf`, `resume`, and `srs` across more
    modes. Target picker now emits those params, but several target routes do
    not fully consume them yet.

## Current Functional Gaps To Fix

These are not just "nice to have" differences; they can create confusing user
behavior now that the source-style picker exists.

1. `StudyPicker` can emit `level`, but target session routes currently ignore
   `level` in several places. Source filters by beginner/intermediate/advanced
   in visual, verbal, written, match, quiz, and test pages.

2. `StudyPicker` can emit `hf=1` for hands-free flashcards and quiz, but target
   `StudyVerbal` and `StudyQuiz` do not implement source hands-free behavior.
   A user can click a hands-free path and land in a mostly normal typed/tap
   experience.

3. `StudyPicker` resume links currently focus on visual resume. Source verbal
   supports resume behavior too. Target `StudyVerbal` does not currently honor
   source resume/session restoration.

4. Target `StudyQuiz` does not accept or use `hf`, `level`, or premium/device
   TTS choices. Source `/decks/[deckId]/quiz` does.

5. Target `StudyVerbal` does not accept or use `hf`, `resume`, `srs`, or
   `deckTitle` the same way source does.

6. Source AI import is missing. Target import is useful for CSV/text decks, but
   source parity requires `/api/study/decks/[deckId]/import` and the import
   parser flow for PDF/image/text/URL extraction.

7. Any Study OpenAI endpoint added or kept in this repo needs Admin AI Usage
   instrumentation. That includes evaluate, AI import, and OpenAI TTS if it is
   ported.

## Remaining Port Slices

Recommended order from least risky/confusing to largest:

1. Route-parameter parity slice.
   Add `level` filtering to target visual, verbal, written, match, quiz, and
   test routes. Add route-level acceptance for `hf`, `resume`, and `srs` where
   source supports them, even if some behavior is still explicitly disabled or
   hidden until the matching component is ported.

2. Disable or accurately label incomplete hands-free links.
   Until the full source hands-free components are imported, prevent the picker
   from advertising working hands-free flows that are not implemented. This is
   a short stabilization slice if full hands-free import is not done next.

3. Full source `StudyVerbal` slice.
   Port source `study-verbal.tsx` into
   `src/features/study/study-verbal.tsx`, adapted to `/study/...` routes and
   `/api/study/...` APIs. Preserve manual mode, hands-free mode, speech
   recognition, silence timing, rating recognition, resume, SRS, device TTS,
   and optional AI voice behavior.

4. Full source quiz/hands-free slice.
   Port source `quiz-session.tsx` into the target Study lane or merge its
   behavior into `study-quiz.tsx`. Preserve multiple-choice and true/false
   behavior, hands-free mode, speech recognition, device TTS, OpenAI TTS,
   prefetching, SRS missed-card requeueing, and result recording.

5. Study TTS and storage slice.
   Port `/api/tts` as `/api/study/tts` or another namespaced route, plus the
   storage helper. Decide whether to reuse source R2 env vars or defer caching
   behind a no-cache response path. If OpenAI TTS is active, add AI Usage
   instrumentation.

6. AI evaluation instrumentation slice.
   Update `/api/study/evaluate` to the QuesIQ app's current AI run pattern.
   Use the source prompt/rubric as the behavior reference, but record
   `ai_runs` rows with model, status, duration, token usage when available, and
   safe raw metadata. Decide whether to keep `gpt-4o-mini`, use source `gpt-4o`,
   or move to the current platform default through prompt config.

7. Full source AI import slice.
   Port `src/server/import-parser.ts` behavior into a Study-prefixed target
   module. Add `/api/study/decks/[deckId]/import`. Support PDF, images, plain
   text, URLs, focus hints, and failed URL reporting. Add AI Usage
   instrumentation for OpenAI parsing calls.

8. Source import wizard parity slice.
   Replace or expand target `StudyImportWizard` to match source source-type
   tabs and review/save flow: file upload, pasted text, URLs, CSV/Quizlet/Anki,
   focus hint, failed URL display, and source API route usage.

9. Folder management slice.
   Port `folders` server logic, `/api/folders`, `/api/folders/[folderId]`, and
   `FolderManager`, namespaced to Study and `study_folders`. Wire deck list and
   edit form to folder assignment.

10. Library taxonomy slice.
    Add Study-prefixed equivalents or carefully mapped tables for source
    subjects, audience tags, trusted sources, deck audience tags, card sources,
    verifications, and deck imports. Port `getRootSubjects`,
    `getAudienceTags`, `getLibraryDecks`, and `LibrarySearch`.

11. Public toggle slice.
    Port source `PublicToggle` UX into the target Study deck page, using the
    namespaced `/api/study/decks/[deckId]` route.

12. Stats parity slice.
    Compare source `src/server/stats.ts` and `/decks/[deckId]/stats` to the
    target stats page. Fill any missing card-level status, fluency, due, weak,
    mastery, and attempt details.

13. Deck/card form parity slice.
    Compare source `DeckForm`, `CardList`, and `CardEditor` against target
    `StudyDeckForm` and `StudyCardList`. Fill missing fields and edit states,
    especially hints, folder assignment, exam metadata, and card editor polish.

14. Library/fork permission QA slice.
    Verify private decks remain private, official decks are not exportable,
    public deck copy works, owners can edit only their own decks/cards, and
    signed-out users can only see allowed public library content.

15. Cleanup decision slice.
    Ask the user to explicitly keep or remove target-only additions:
    `/study/history`, `/study/decks/[deckId]/start`, private deck export, and
    scope filters in library. Keep them only as deliberate product decisions.

## Recommended Next Slice

Do the route-parameter parity and hands-free labeling slice next.

Reason: the source-style Study picker is already visible, but target routes and
components do not fully honor the params it emits. Fixing that first prevents
clicking into misleading modes while the larger hands-free/TTS import is still
in progress.

Minimum acceptance for that slice:

- `level=beginner|intermediate|advanced` filters cards in every target Study
  mode route.
- `hf=1` is either fully honored or not offered in the picker.
- `resume=1` behavior is only linked for modes that actually resume.
- `srs=1` is preserved only for modes that requeue/rate SRS correctly.
- Links from the deck page route to existing `/study/...` URLs only.

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
