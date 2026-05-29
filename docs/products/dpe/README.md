# QuesIQ DPE

QuesIQ DPE should be imported as its own product lane inside the shared QuesIQ
platform.

## Target Lane

Use:

- `src/features/dpe/`
- product-owned routes under the future app product route structure
- DPE-specific database tables keyed by shared Auth.js `user.id`

## Boundaries

QuesIQ DPE has a distinct audience and may later justify a separate native app
listing for app-store positioning. That does not require a separate web service
now.

QuesIQ DPE owns its own:

- aviation/DPE content model
- oral-exam practice sessions
- pilot progress records
- DPE-specific prompts/AI calls
- DPE-specific admin views

Shared platform owns auth, account, product selection, billing when added, and
common shell behavior.

## Import Status

First import slice completed locally on 2026-05-29:

- `/dpe` now renders the imported QuesIQ DPE product workspace.
- DPE APIs live under `/api/dpe`.
- DPE product data uses `dpe_*` tables keyed by the shared Auth.js `user.id`.
- Migration `0050_add_dpe_baseline_tables.sql` creates the baseline DPE tables
  and seeds placeholder Private Pilot ASEL content.
- The current practice loop is the source app's typed oral-preview flow:
  question selection, local answer capture, persisted session history, and
  transcript-backed review.
- DPE review generation writes shared `ai_runs` rows with run type
  `dpe_review`; DPE session ids are stored in AI run metadata because shared
  `ai_runs.session_id` still points at Interview sessions.
- DPE voice MVP now uses `/api/dpe/realtime/session`, reusing the shared
  browser Realtime client while keeping the DPE prompt/session boundary.
- Finalized DPE voice artifacts save through
  `/api/dpe/practice-sessions/[id]/artifact`, then feed the existing DPE
  review path.

The raw DPE source archive under
`C:\Users\weeks\Documents\github\DPE\docs\checkride question content` was not
copied into QuesIQ. It is large reference/source material and should be handled
through a deliberate content-import slice.

## Next DPE Slices

1. Deploy and apply migration `0050_add_dpe_baseline_tables.sql`, then verify
   `/dpe` with a signed-in account.
2. QA the DPE voice MVP in a signed-in browser with microphone permission and
   OpenAI Realtime env vars configured.
3. Build the real aviation content curation/import path from the DPE source
   workbook/PDF material. Keep placeholder content clearly marked until final
   answer keys and rubrics are authored.
