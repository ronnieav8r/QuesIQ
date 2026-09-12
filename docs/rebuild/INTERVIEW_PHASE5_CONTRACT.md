# Phase 5 implementation contract

Authorized 2026-09-08: plan and execute P5.1 through P5.4 sequentially in
QuesIQ-dev. The execution ledger owns acceptance. Existing Phase4 changes are
preserved. No schema or dependency change is planned.

## Product decisions

- First Impression: one natural opening introduction question, one focused
  answer-grounded critique, Try again or Finish. One optional retry preserves
  the exact question; the second critique offers Finish only. Both attempts
  appear in review, with the retry identified as assisted. No question focus,
  saved introduction or resume is required. Target and interviewer style remain.
- Rapid Fire: selected fixed count (1-10), one question at a time, Done answering
  controls submission, immediate deterministic advancement, no coaching choices
  or feedback between questions. Review follows the run, including an early end
  with a committed answer. Empty/failed input does not advance.
- Coaching retains its accepted explicit choices and same-question iteration.
- Mock Interview retains Realtime and natural follow-ups, no mid-session
  coaching by default, evaluation after ending. Model selection stays pinned
  and configurable; no model comparison or automatic Mini promotion.

## Sequencing and ownership

1. P5.1 First Impression: mode policy, versioned configuration/catalog routing,
   controlled native/inspector flow, review eligibility and attempt evidence.
2. P5.2 Rapid Fire: extend the same controlled engine and inspector; validate
   count/advance/end rules and keep historical web and Realtime paths readable.
3. P5.3 Mock Interview: inspect and harden configuration, end/recovery behavior,
   prompt composition and post-interview review; deterministic scenario tests.
4. P5.4 four-mode acceptance: combined regression, native build/export, framed
   browser evidence, docs reconciliation and final remaining-gates record.

Manager owns shared contracts, configuration, central services and integration.
One bounded worker may own independent tests or native presentation after the
relevant interface is frozen. No recursive delegation or overlapping edits.

## Common invariants

New mode behavior is explicitly versioned in the session snapshot. Never switch
an existing pinned Realtime session to chained execution. Legacy unpinned
sessions retain legacy routing. Respect runtime disabled flags. Mobile catalog
restoration must not silently enable retired web Practice behavior.

Activation is deliberately local-only: new FI catalog exposure, controlled
Rapid Fire and Mock behavior v1 require a non-production backend. FI's historical
database catalog flag remains off for the retired web feature; the separate local
native catalog policy does not modify that flag. Its runtime enabled=false still
blocks bootstrap/creation. Production continues prior routing until a separately
authorized activation; local acceptance is not a production-ready rollout claim.

The server owns mode, question, limits, revisions and transitions. Model text
cannot advance state or authorize another attempt. Operation replay precedes
state validation; stale/double/late requests cannot bill or advance twice.
End dominates late work. Controlled modes reuse the existing audio/typed adapter;
Mock retains its Realtime adapter with the shared account-safe recovery path.
No duplicated transport or automatic recording on restart.

Review retains actual committed answers, supported evidence, original versus
assisted attempt labels and prompt versions. No invented improvement percentage
or conflation of assisted and independent scores. Short First Impression and
Rapid Fire use answer eligibility, not the long Mock duration gate. No answer
means no evaluation. Save failure and uncertain evaluation preserve explicit
recovery boundaries.

Inspector runs use the same policies with isolated test records; default remains
Test Coaching / no audio, Fit, Simulation. Candidate v2 remains Coaching-only
and inspector-only. New prompt behavior is a local implementation candidate;
deterministic tests do not certify semantic quality or authorize promotion.

## Acceptance per package

Targeted policy/service and native tests cover normal flow, forbidden choices,
empty input, retry/end/replay, disabled configuration, session ownership and
legacy routing. Typed inspector tests exercise save/reopen of test records
without learner writes. Learner History tests exercise owned saved artifacts.
Each integrated package passes the full Interview gate, mobile typecheck/tests
and relevant lint. UI changes receive headless framed small/large checks.
Final package includes Android compilation and Hermes export.

Physical microphone/speaker/keyboard/accessibility, interruption/process-kill,
actual latency, signed iPhone distribution and paid/human prompt-quality gates
remain explicitly unverified. No deployment follows local acceptance.

## Mock policy and inspection

New local Mock sessions pin `mock_interview_behavior@1` alongside the actual
Realtime prompt/model. The dedicated spoken contract overrides conflicting
rehearsal/coaching instructions, uses natural follow-ups and defers advice to
the saved review. Irrelevant introduction/story-rehearsal/count fields are
cleared. Older pinned or unpinned sessions retain their previous prompt behavior.
The normal120-second Mock review minimum and usable-answer requirement remain;
missing duration is not accepted as a completed long-form interview.

The existing Realtime Model Lab has an explicit `native_mock_v1` variant for
Mock scenarios only. It resolves the same native policy and saves test-run
metadata, not learner sessions. Historical `production_v1` remains unchanged.
Selecting/running this variant still requires separate paid-test authorization;
it has not been run against a provider. Deterministic prompt-composition and
variant-routing checks do not assess model behavior or justify changing models.
