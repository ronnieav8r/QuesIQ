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
  first usable deck-management slice
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
- `/study/library` shows public Study decks from the shared database
- signed-in users can create/edit decks, add/delete cards manually, and review
  cards with simple recall ratings
- Study reuses the shared platform Auth.js session
- baseline Study deck/card/session tables are added with `study_` prefixes
- deeper import automation, library curation/filters, quiz modes, and TTS still
  need to be imported

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
