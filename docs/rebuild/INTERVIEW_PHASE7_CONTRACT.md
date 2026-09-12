# Phase 7 — Interview local beta readiness

Approved scope: user implementation request, 2026-09-10. Local QuesIQ-dev only.
Execution evidence is owned by INTERVIEW_EXECUTION_STATUS.md.

The subsequent local voice-safety implementation is documented in
INTERVIEW_CHAINED_VOICE_SAFETY.md; it preserves the activation blocks below.

## Acceptance and boundaries

P7.1 accounting, P7.2 safety, P7.3 economics reporting, then P7.4 combined local
verification. Preserve accepted Phase4–6 work; do not enable P6.6. No paid calls,
device/emulator operation, credentials/configuration changes, production migration,
commit, push or deployment. Synthetic tests are not actual economics or AI quality.

The result is a locally verified candidate with provider activation disabled.
Real voice remains blocked: direct Realtime termination is unverified, and the
text request bound does not certify transcription/TTS audio costs. Existing voice
models and local mock flows remain intact. This is an explicit activation gate,
not evidence that the real voice product is ready.

## Accounting and provider inventory

All Interview AI-run types use startAiRun/completeAiRun. Each new run stores
version1 interview_accounting: operation/attempt identity, mode, provenance,
usage source, coverage, frozen tariff and nullable estimated micro-USD. Tariff
calculations are estimates even with provider-reported tokens. Partial usage
produces a labelled subtotal; missing data/rates stay unknown. Completion is
conditional/idempotent; a second catch cannot replace the first provider outcome.

| Operation | Existing implementation and handling |
| --- | --- |
| Text turns, routing, corrections | turn-based.ts; each dispatch uses its own AI run; Coaching durable operation provides attempt scope |
| Transcription/TTS | turn-based.ts; recorded attempts, unknown usage stays unknown; live audio dispatch blocked until its cost bound is verified |
| Resume, introduction, story drafts | resume-summary.ts, introduction-ai.ts, story-ai.ts; mobile draft claims retain replay semantics and pass an operation scope |
| Answer/session evaluation | answer-evaluations.ts, create-session-evaluation.ts; usage derives from frozen tariff, including failed known-usage attempts |
| Debrief | debrief-ai.ts; same guarded text dispatch and accounting |
| Realtime, story/debrief voice, model lab | existing routes/lab; real activation blocked, mocked configuration/lifecycle tests preserved |

Fallback identities hash account/session/type/model/prompt/metadata; durable
Coaching and preparation scopes include their owned request IDs and child attempt
index. The reservation uniqueness rule blocks uncertain repeated dispatch.
Validated Coaching replay returns text without automatically regenerating TTS.
Failed audio can be read as text; a budget denial after text returns a structured
limit alongside the validated response so native code saves it and stops capture.

Turn-based artifacts no longer receive an additional duration-based Realtime
estimate. Historical records remain readable; the report excludes these old
misattributed aggregates where the pinned engine establishes the distinction.
Legacy unknowns are labelled, not reconstructed with today's pricing. Missing
Realtime pricing is nullable for new records; legacy missing-pricing zero is
reported as unknown. Realtime duration estimates remain modeled and partial.

## Safety policy and state

Real-provider activation requires all of these server environment settings:

- INTERVIEW_BETA_ENABLED=1
- INTERVIEW_BETA_SESSION_MICRO_USD
- INTERVIEW_BETA_ACCOUNT_24H_MICRO_USD
- INTERVIEW_BETA_GLOBAL_24H_MICRO_USD
- INTERVIEW_BETA_OPERATION_MICRO_USD: JSON object of positive integer ceilings
  keyed by run type; evaluation is mandatory, and each invoked type must exist
- INTERVIEW_BETA_MAX_INPUT_BYTES and INTERVIEW_BETA_MAX_OUTPUT_TOKENS

No monetary or activation defaults were installed. Tests use explicit fixture
values only. One global PostgreSQL transaction advisory lock serializes all
reservations and settlements. Per-account/global windows use dispatch creation
time and a rolling24hours; unknown holds do not age out. Per-session totals span
the entire session. Synthetic reservations are a separate accounting population.

The first live operation admits the owned session, reserves its final evaluation,
and creates an account lease using the pinned maximum session duration. Reconnect
does not reset its deadline. Another live session is denied until end/expiry.
An expired session cannot revive its allowance. Review consumes its pre-reserved
slot; answer evaluations and other calls still need their own ceilings. Saving
releases the lease; an empty/too-short artifact releases unused review allowance.
Budget cleanup failure does not reverse an acknowledged artifact save.

Reservations precede dispatch. Complete known cost settles once; incomplete or
uncertain outcomes hold the ceiling. Confirmed pre-dispatch rejection releases
that attempt's reservation and records its reason. A new provider attempt has a
new run; application replay does not buy another attempt. History/manual edits
and artifact storage are not gated by provider budgets.

Text dispatch is single-use and limited to Responses/Chat Completions with
explicit text messages. It refuses hidden server context, tools, multimodal input,
multiple completions, background work and streaming. Requests preserve a lower
existing output limit; otherwise the configured maximum is applied. A conservative
UTF8-byte estimate plus framing headroom and frozen uncached rates must fit the
reserved ceiling before dispatch. This is admission estimation, not billing proof;
real model/token behavior remains a paid-validation gate. Non-text calls fail closed.

Provider output limits include reasoning tokens per official documentation:
[Responses](https://developers.openai.com/api/reference/cli/resources/responses/methods/create),
[Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create).
No model substitution or live documentation smoke request was performed.

## Client and reporting contracts

Shared limit outcomes contain a stable reason, optional reset time, permitted
recovery actions and review availability. HTTP errors use429/interview_limit with
retryable=false. A successful validated turn can also carry a limit after its
audio stage is denied. Native clients append the validated text, stop transport,
ignore late callbacks and save committed text through existing recovery. A saved
claim appears only after storage succeeds; failed review preserves Open saved
session. Account-switch checks prevent old completions from navigating/clearing
the new account. Local duration/answer timers are secondary controls, not server
spending guarantees. Browser samples remain read-only and explicitly labelled.

Commands, from QuesIQ-dev:

```powershell
npm run test:interview:beta
npm run interview:economics -- --from 2026-09-10T00:00:00Z --to 2026-09-11T00:00:00Z --json artifacts/report.json --csv artifacts/report.csv
npm run interview:economics:reconcile
```

The report is read-only and restricted to loopback5433/quesiq_local. Optional
--mode, --account and --include-synthetic filters apply. Intervals are half-open.
Active users are distinct attributable accounts initiating provider-backed work;
preparation contributes to account cost but remains separate from session cost.
Unattributed legacy costs remain separate from the per-known-user denominator.
Reports include operation/mode/account/session subtotals, incomplete coverage,
pricing versions, failures/pending work, current unknown holds and blocked reasons.
Only allowlisted metadata is exported; no transcript, prompt, resume, secret or audio.

The separate reconciliation command mutates only already-known complete usage
settlements in the local database. It cannot manufacture a cost or release unknown
usage. Run it after a known completion could not settle due to storage failure.

## Verification and follow-up

Unit and actual local-DB tests cover frozen prices, missing/partial/zero/cached
usage, concurrent budget boundaries, ownership, duplicate requests, expired leases,
unknown holds, review reservation, storage failure and production bypass rejection.
Independent Luna/medium tests cover accounting/report behavior. Terra/medium owns
the bounded native slice; manager reviews and corrects integration. One worker at
a time; no recursive delegation or measured token-savings claim.

Final evidence includes full Interview/mobile gates, typecheck/lint, Android debug
compile and Hermes export, plus inspected browser phone captures. See the ledger
for passing final logs and retained failures; no physical-device proof is implied.
Remaining operational decisions are in INTERVIEW_V1_REMAINING_GATES.md.
