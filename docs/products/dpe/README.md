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

The persistent quest set covers first oral session, first readiness review, ACS
area/task coverage, answered prompts, a 4+ readiness score, weak-focus
resolution, and saved checkride target details. Weak-focus resolution is derived
from stored completed sessions by comparing historical weak ACS area/task keys
against the latest completed session's weak signals; it remains a readiness
habit signal, not a certification claim.

## MVP Readiness Scaffolding (No Content Expansion)

DPE now treats checkride target tracks as product scaffolding, independent of
whether full oral content is loaded.

Supported target-track metadata in DPE lane:

1. Private Pilot ASEL (`PPL-ASEL`) - current default/demo content track.
2. Instrument Airplane Land (`IRA`) - scaffolded, content pending.
3. Commercial Airplane Land (`CAX-ASEL`) - scaffolded, content pending.
4. CFI Airplane Land (`CFI-A`) - scaffolded, content pending.
5. CFII Airplane Land (`CFII-A`) - scaffolded, content pending.
6. Multi-Engine Airplane Land (`MEL`) - scaffolded, content pending.
7. MEI Airplane Land (`MEI-A`) - scaffolded, content pending.

MVP behavior notes:

1. DPE Me stores selected track plus aircraft category/class using existing
   `dpe_checkride_targets` fields (`certificate`, `aircraftCategory`,
   `aircraftClass`) with no new schema.
2. Home and Practice show track-aware readiness messaging so no-content tracks
   are not mistaken for app failure.
3. For no-content tracks, users can continue with available Private Pilot demo
   prompts while keeping their selected target track for readiness scaffolding.
4. This slice does not add or seed aviation question/answer/rubric content.

## MVP Learner Polish Slice 2

This follow-up MVP slice keeps content unchanged and focuses on learner
workflow clarity:

1. History now supports selecting a specific stored session review instead of
   always showing only the latest review.
2. History cards now include a `Reopen in practice` action that loads that
   exact saved review into the Practice review stage.
3. Home now includes an actionable readiness checklist that calls out:
   target completeness, track content/scaffold status, first oral session,
   first review, progression service state, and the next practice action.
4. Home uses persisted `/api/dpe/progression` data when available and falls
   back to local session-derived readiness signals when progression is
   unavailable.
5. Practice setup copy is tightened for scaffolded/no-content tracks so users
   understand they can continue with available Private Pilot demo prompts
   without losing their selected target track.

Remaining MVP gaps (outside this slice):

1. Real DPE aviation content curation/import for non-Private tracks.
2. Deeper review history comparison and trend views across saved sessions.
3. Weak-focus resolution quest logic once richer durable review history is in
   place.

## MVP Learner Polish Slice 3 (Voice/Session Recovery)

This slice focuses on learner reliability and recovery without changing
content, schema, or publish behavior:

1. Voice launch now has a clear recovery path when a persisted DPE session
   cannot be created. Instead of a dead end, the app falls back to typed
   practice immediately with explicit messaging.
2. Practice surfaces a visible fallback notice (`voice -> typed`) so users
   understand why microphone flow did not continue.
3. History now provides a `Generate review` action for completed sessions that
   still have no saved review, using existing
   `POST /api/dpe/practice-sessions/[id]/review`.
4. History status labels and CTA copy are tightened around session lifecycle
   states: in progress, completed, review incomplete, review ready.
5. Completed/no-review cards are no longer dead-end; users can either open the
   fallback review preview or generate/save a review and then reopen it in
   Practice.

Remaining MVP gaps after this slice:

1. Resume/continue behavior for persisted `in_progress` sessions (currently
   recovery focuses on completed-session review and voice launch fallback).
2. Review retry diagnostics/history (attempt count, failure reason timeline).
3. Track-specific real oral content for non-Private target tracks.

## MVP Learner Polish Slice 4 (In-Progress Resume)

This follow-up slice makes persisted `in_progress` sessions actionable without
schema or content changes:

1. History now exposes a `Continue session` action for stored `in_progress`
   sessions.
2. Continue loads the saved session into Practice live typed flow, preserving
   saved questions and transcript answers, and resumes at the next unanswered
   prompt.
3. If a stored `in_progress` session is missing enough prompt evidence to
   continue exact prompts, Practice now explains why and routes the learner to
   start a new session with the same area/task filters where possible.
4. Lifecycle status labels are tightened for `in progress`, `session open`,
   `review incomplete`, and `review ready` so each state has an explicit next
   action.

Remaining MVP gaps after this slice:

1. Resume/continue diagnostics and retry telemetry for partial/invalid stored
   session payloads.
2. Review retry diagnostics/history (attempt count, failure reason timeline).
3. Track-specific real oral content for non-Private target tracks.

## MVP Learner Polish Slice 5 (Review Generation Hardening)

This slice hardens DPE review generation so learners do not hit dead-end
errors when AI review calls fail:

1. `POST /api/dpe/practice-sessions/[id]/review` now saves and returns a
   deterministic fallback review when the OpenAI key is missing, provider
   response is non-OK, JSON parsing fails, or request/runtime errors happen
   after session load.
2. Fallback review persistence still uses existing DPE session storage and
   marks progression review completion the same way as existing deterministic
   fallback behavior.
3. AI run records are still finalized as failed when AI generation fails, while
   learner response returns a usable saved fallback review where storage is
   available.
4. DPE review model selection now prefers `OPENAI_DPE_REVIEW_MODEL`, then
   falls back to `OPENAI_REVIEW_MODEL`, then default model.

## MVP Learner Polish Slice 6 (Target-Aware Prompt Framing)

This slice aligns DPE AI/realtime framing with selected target-track metadata
without changing content tables:

1. DPE review-generation prompt text now uses session target metadata
   (`acsTitle` and stored prompt certificate metadata when present) instead of
   hardcoding Private Pilot wording for every learner.
2. DPE realtime session instructions now frame the learner as the selected
   target track and include explicit scaffold/content-pending guidance for
   non-Private tracks.
3. Prompt context now makes it explicit that non-Private tracks can be
   scaffolded and may reuse available demo prompts, and that evaluation should
   stay conservative when answer-key/rubric coverage is incomplete.
4. Existing deterministic fallback review persistence, AI-run tracking, and
   progression hooks are unchanged.

## MVP Learner Polish Slice 7 (Target-Aware Learner Chrome)

This slice aligns visible learner copy and voice-launch framing with selected
target-track metadata:

1. DPE app chrome subtitle now reflects selected target track metadata instead
   of fixed Private Pilot wording.
2. Sign-in subtitle is now neutral (`Target-track oral prep`) so it does not
   imply every learner is Private Pilot before profile/target selection loads.
3. Voice first-turn instructions in learner UI now use session target metadata
   (`targetTrackTitle`, then prompt certificate title, then generic fallback).
4. For non-Private targets using Private demo prompts, first-turn instructions
   explicitly acknowledge scaffolded/content-pending track behavior while
   preserving current fallback-content honesty.
5. Stored/resumed session objects now carry `acsTitle` into local
   `targetTrackTitle` where available so resumed voice context remains
   target-aware.
6. Live/voice session headers now use the same target-track label logic as
   launch framing, so runtime learner copy stays consistent during practice.

## MVP Learner Polish Slice 8 (Airplane-Land Target Alignment)

This slice makes DPE target metadata explicit that non-Private MVP tracks are
airplane-land targets:

1. Instrument, Commercial, CFI, CFII, Multi, and MEI target titles/certificate
   metadata are now consistently labeled as airplane-land tracks in DPE-owned
   target metadata.
2. Resolver compatibility keeps older saved certificate strings mappable to the
   updated airplane-land labels so existing profile/target state still resolves
   cleanly.
3. DPE preflight now enforces airplane-land title/class metadata contracts for
   these track codes to prevent regression.

## MVP Learner Polish Slice 9 (Production Status Visibility)

This slice keeps content unchanged and brings production readiness signals into
the DPE learner Home surface:

1. The app now calls the safe public `/api/dpe/status` probe on load.
2. Home shows a `DPE production status` panel with content-table reachability,
   loaded prompt count, ready/scaffolded target-track count, and selected-track
   status.
3. The panel lists all configured airplane-land target tracks as ready or
   scaffolded, making the current no-content boundary visible without requiring
   admin cookies.
4. This is deployment/readiness visibility only. It does not approve, publish,
   seed, or modify aviation content.

## MVP Learner Polish Slice 10 (Realtime Turn Continuation)

This slice fixes DPE voice-practice continuation without changing content:

1. The shared realtime voice client now treats `/api/dpe/realtime/session` as
   an endpoint that should request the next Que response after each completed
   applicant voice turn.
2. DPE voice sessions keep the existing first-turn setup, transcript artifact
   save path, and review generation flow.
3. DPE preflight now checks the shared realtime client contract so this
   endpoint does not regress back to a one-turn voice interaction.

## MVP Learner Polish Slice 11 (Voice Error Recovery)

This slice improves DPE voice-practice recovery without changing content:

1. If microphone permission, browser WebRTC setup, or realtime session exchange
   fails inside the voice component, DPE now offers `Use typed practice`.
2. The recovery keeps the same saved DPE session, selected prompts, target
   track, ACS area/task, and review path, but switches the active session to
   typed answers.
3. Learners get a visible notice explaining that voice was unavailable and the
   same prompts can continue into a readiness review.
4. The shared realtime component exposes an optional error recovery action, so
   Interview behavior is unchanged unless a caller opts in.

## MVP Learner Polish Slice 12 (Auth Loading Recovery)

This slice prevents the DPE shell from getting stuck during access bootstrap:

1. DPE auth loading now has an 8-second recovery timer.
2. If `/api/dpe/me` stalls or fails, the learner is moved to the signed-out
   screen instead of staying on `Loading access...`.
3. A later successful auth response can still set the authenticated app state;
   this only protects the initial loading experience.
4. Content, target-track metadata, and aviation prompts are unchanged.

## MVP Learner Polish Slice 13 (Signed-Out Product Status)

This slice makes the public DPE page clearer before login:

1. The signed-out screen now receives the safe public `/api/dpe/status` signal.
2. Visitors can see DPE target tracks, content-table reachability, loaded prompt
   count, and ready/scaffolded track count before signing in.
3. The page still requires an account for practice sessions, history, reviews,
   and voice work.
4. No content is created, approved, published, or modified.

## MVP Learner Polish Slice 14 (Runtime Readiness Signals)

This slice adds safe DPE runtime-readiness visibility without exposing secrets:

1. `/api/dpe/status` now reports boolean `reviewAiConfigured` and
   `realtimeVoiceConfigured` fields.
2. Signed-out and signed-in DPE status panels show Review AI and Voice AI
   readiness alongside content table and target-track status.
3. These flags only confirm whether server-side prerequisites are configured;
   they do not reveal key names, values, model details, or user data.
4. No aviation content is created, approved, published, or modified.

## MVP Learner Polish Slice 15 (Review Retry Recovery)

This slice improves DPE review recovery without changing content or schema:

1. Persisted DPE review screens now expose `Retry AI Review`.
2. The action reuses the existing saved-session review endpoint, so it can
   replace a deterministic fallback with an AI-generated review when runtime
   dependencies are available.
3. The retry action is available from the active Practice review screen and
   reopened History reviews.
4. No aviation content is created, approved, published, or modified.

## MVP Learner Polish Slice 16 (Profile Date Hardening)

This slice hardens DPE profile persistence without changing content:

1. DPE profile saves now parse checkride dates through a strict `YYYY-MM-DD`
   helper before writing the active target.
2. Empty or malformed dates are stored as `null` instead of risking an invalid
   date write.
3. Target-track normalization remains unchanged, so Instrument, Commercial,
   CFI, CFII, Multi, and MEI airplane-land tracks keep their configured
   metadata.

## MVP Learner Polish Slice 17 (Profile Date Read Recovery)

This slice hardens DPE profile loading without changing content:

1. DPE profile state now formats stored checkride dates through a guarded
   helper before filling the Me screen.
2. Malformed historical date values become an empty checkride date instead of
   throwing during app render.
3. Target-track, aircraft, session, review, and content behavior are unchanged.
