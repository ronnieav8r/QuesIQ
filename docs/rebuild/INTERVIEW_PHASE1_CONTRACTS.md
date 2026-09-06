# Phase 1 implementation contract

Manager specification, 2026-09-06. Implements P1.1 of the approved roadmap.
New contracts are additive; runtime wiring and acceptance follow separately.

## Execution configuration

`InterviewRuntimeSettings`: modeKey (four mobile modes), enabled, engine
(`turn_based` or `realtime`), feedbackDepth (`brief`, `coaching`, `review_only`),
maxAnswerSeconds/maxDurationSeconds/maxTurns (positive integers), textModel,
transcriptionModel, ttsModel, ttsVoice (nonempty bounded strings), optional
realtimeModel. Keep existing field names for runtime adapter compatibility.

`InterviewExecutionConfig`: schemaVersion=1, surface (`native` or `inspector`),
revision (64 lowercase hex SHA-256), configured and effective runtime settings,
overrides (bounded array of `{ field, reason }`), and promptVersions (bounded
array of `{ key, version }`; nonnegative integer versions, with zero retaining
the repository's existing fallback identity and positive versions identifying
database records). Both settings must
name the same mode. Inspector is Coaching-only. Effective realtime execution
requires realtimeModel. Effective enabled must never turn a configured false
into true. Unknown fields rejected; no keys/credentials in this structure.

The server resolves this metadata, never the client. Attach it to stored native
session snapshots as optional `executionConfig`; legacy snapshots remain valid.
Client-provided executionConfig must be discarded at create-session parsing.
New sessions pin configuration at creation. Legacy sessions resolve/pin once
before first execution using an atomic conditional update, not every turn.
Hash public settings and prompt-version references, excluding timestamps/secrets.

Preserve current engine routing while consolidating: native Coaching chained;
other currently enabled native modes Realtime. Inspector uses Coaching's native
chain. Expose model/voice overrides instead of hiding them. Respect catalog and
runtime disabled flags; First Impression is currently catalog-disabled and will
return through its explicit Phase5 implementation, not a fallback bypass.
Do not change web fallback routing or hands-free gating in this slice.

Realtime model/voice come from the selected active realtime prompt, not the
runtime table's unrelated textModel. Existing prompt bodies remain unchanged
in Phase1. Pin their versions and retrieve those versions when composing a
session; never label current prompt contents as an older pinned version.

## Exercise state

`CoachingExerciseState`: schemaVersion=1, revision (nonnegative integer), phase
(`ready`, `awaiting_answer`, `awaiting_choice`, `awaiting_clarification`,
`completed`), primaryQuestionIndex (0..10), primaryQuestionLimit (1..10),
attemptIndex (nonnegative integer), question (null or `{id,text}` nonempty bounded
strings). Index must not exceed limit. Ready has no question/index0/attempt0;
active phases require question, positive question index, and positive attempt.
Completed may retain the most recent question. No microphone or provider state
belongs in this durable exercise state; pending operations remain in the ledger.

`CoachingExerciseAction`: start, answer, try_again, more_feedback, ask_que,
clarify, move_on, end. A command contains operationId, expectedRevision, action,
and optional text (bounded12000). Answer/clarify require nonblank text; other
actions must not smuggle arbitrary routing/configuration fields.

Transitions:

| Current | Action | Result / operation |
| --- | --- | --- |
| ready | start | Generate primary question1, attempt1, awaiting_answer |
| awaiting_answer | answer | Evaluate submitted answer, awaiting_choice |
| awaiting_choice | try_again | Same question/ID, increment attempt only, awaiting_answer; no model needed |
| awaiting_choice | more_feedback | Explain feedback, same question/attempt, awaiting_choice |
| awaiting_choice | ask_que | Await clarification text, no model needed |
| awaiting_clarification | clarify | Answer clarification, same question/attempt, awaiting_choice |
| awaiting_choice | move_on | Generate next primary question/attempt1, or complete when limit reached |
| any noncompleted | end | Complete, no further generation |

Reject other actions and stale revisions. Every accepted transition increments
revision once. Replayed operation IDs return the original result before state
validation; same ID/different payload conflicts. Pending/uncertain operations
retain the existing no-automatic-regeneration protections. End/session finality
dominates late provider results. Provider content cannot choose the transition,
advance counts, replace the question on retry, or end a session independently.

Legacy native/inspector request shapes get a boundary adapter: turnIndex acts as
operation sequence; explicit choice routes are mapped to commands. Legacy
ask_que requests already contain clarification text and map to clarify in one
operation. Preserve old response fields while adding exerciseState. Derive
legacy state from persisted structured results, never assistant-text regex.

## P1.1 worker boundaries / gates

First worker owns only a new shared contract module, its tests, and exports
from the existing package index/test entry. No runtime/schema migration or UI
changes. Tests cover valid settings/state, unknown fields, mixed modes,
disabled override, missing realtime model, invalid counts, absent question,
blank answer/clarification, and legacy snapshot parsing without new metadata.
After manager acceptance, resolver/state-controller workers use these contracts.
