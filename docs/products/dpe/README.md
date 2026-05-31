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
- DPE Me now persists preferred name, aircraft, checkride date, DPE name,
  school/instructor context, weak areas, and notes through `/api/dpe/profile`.
- DPE Home reflects saved aircraft/checkride/DPE context.
- DPE practice and content readiness UI now distinguishes draft, incomplete,
  ready-for-review, not-published, and published/verified states using the
  existing DPE question, answer-key, rubric, and content-version contracts.
- The DPE-owned content view can filter by certificate, ACS area, and ACS task,
  and surfaces missing oral-question coverage, answer-key gaps, rubric gaps, and
  lightweight readiness percentages without changing storage or publish
  behavior.

The raw DPE source archive under
`C:\Users\weeks\Documents\github\DPE\docs\checkride question content` was not
copied into QuesIQ. It is large reference/source material and should be handled
through a deliberate content-import slice.

## Next DPE Slices

1. Deploy and apply migration `0050_add_dpe_baseline_tables.sql`, then verify
   `/dpe` with a signed-in account.
2. QA the DPE voice MVP in a signed-in browser with microphone permission and
   OpenAI Realtime env vars configured.
3. QA DPE Me profile persistence after migration `0050` is applied.
4. Build the real aviation content curation/import path from the DPE source
   workbook/PDF material. Keep placeholder content clearly marked until final
   answer keys and rubrics are authored.
5. Add durable Content Studio run storage and publish/audit workflow only from
   the Admin/platform lane; DPE currently treats generated drafts as review
   inputs, not published content.

## DPE Readiness Quest Track

Current DPE lane now has both a non-persistent readiness preview in the client
and a DPE-owned persistent progression backend. Migration
`0053_add_dpe_progression.sql` adds DPE-prefixed progression events, XP rules,
quests, user progression summaries, and user quest state. This is not a
certification state; it is a checkride-readiness habit/progress signal.

Planned DPE quest/rule set:

1. `first oral session`: complete one DPE oral session.
2. `review completed`: generate one transcript-backed review.
3. `ACS area/task coverage`: practice 5 unique ACS area/task combinations.
4. `question count`: answer 20 prompts total.
5. `score threshold`: reach readiness score 4+ in 3 reviewed sessions.
6. `weak ACS resolved`: resolve 2 weak ACS focus keys after re-practice.
7. `checkride target set`: set aircraft and checkride date in DPE Me.

Migration-backed XP awards are now wired at:

1. `PATCH /api/dpe/practice-sessions/[id]` when status transitions to
   `completed` (`dpe_session_completed`).
2. `POST /api/dpe/practice-sessions/[id]/review` when generated review saves
   (`dpe_review_completed`).
3. `POST /api/dpe/practice-sessions/[id]/artifact` when a voice artifact
   completes a DPE session.
4. `GET /api/dpe/progression` returns the signed-in user's DPE progression
   summary and quest state.

The first persistent quest set covers first oral session, first readiness
review, ACS area/task coverage, answered prompts, a 4+ readiness score, and
saved checkride target details. Weak-area resolution remains future work after
more durable DPE review history is available.

## MVP Readiness Scaffolding (No Content Expansion)

DPE now treats checkride target tracks as product scaffolding, independent of
whether full oral content is loaded.

Supported target-track metadata in DPE lane:

1. Private Pilot ASEL (`PPL-ASEL`) - current default/demo content track.
2. Instrument Airplane (`IRA`) - scaffolded, content pending.
3. Commercial Airplane Land (`CAX-ASEL`) - scaffolded, content pending.
4. CFI Airplane (`CFI-A`) - scaffolded, content pending.
5. CFII Airplane (`CFII-A`) - scaffolded, content pending.
6. Multi-Engine Land (`MEL`) - scaffolded, content pending.
7. MEI Airplane (`MEI-A`) - scaffolded, content pending.

MVP behavior notes:

1. DPE Me stores selected track plus aircraft category/class using existing
   `dpe_checkride_targets` fields (`certificate`, `aircraftCategory`,
   `aircraftClass`) with no new schema.
2. Home and Practice show track-aware readiness messaging so no-content tracks
   are not mistaken for app failure.
3. For no-content tracks, users can continue with available Private Pilot demo
   prompts while keeping their selected target track for readiness scaffolding.
4. This slice does not add or seed aviation question/answer/rubric content.
