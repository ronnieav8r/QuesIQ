# Chained voice activation proof package

Reviewed: 2026-09-10. QuesIQ-dev only. Status: documentation complete; live
activation BLOCKED. Main: gpt-6-astra / medium; subagents: none.

This package defines proof obligations and a future test procedure. It does not
implement a runner, authorize spending, or certify provider behavior. The
[execution ledger](INTERVIEW_EXECUTION_STATUS.md) owns acceptance; the
[local safety contract](INTERVIEW_CHAINED_VOICE_SAFETY.md) owns implemented
safeguards. Preserve current models, explicit Done, full-file playback and all
existing Phase4-7 work. Full Realtime interviewer, legacy audio activation,
quality comparisons, devices, hosting selection and release are separate work.

## 1. Evidence matrix and findings

Evidence labels: **D** = official documentation, **L** = local implementation
and previously recorded mocked tests, **V** = observed live provider behavior,
**B** = provider usage reconciled with billing. L is not V or B. This review read
code and existing acceptance records; it did not rerun application tests.
All sources below were retrieved on 2026-09-10. Rates are published reference
values, not installed tariffs, account verification or budget authorization.

| Path / exact request | Billing and documented limits | Existing safeguard / evidence | Missing proof and status |
| --- | --- | --- | --- |
| `gpt-4o-mini-tts`, voice `marin`; POST `/v1/audio/speech`, MP3 | D: text input $0.60/M tokens; audio output $12/M tokens. Model page: 2,000 input tokens; speech API: 4,096 input characters. Neither reviewed source specifies an enforceable audio-output ceiling. Sources S1-S2. | L: speech input truncated to 1,000 JavaScript string code units; 30-second transport timeout; frozen explicit audio units; real dispatch blocked. | No maximum billable output or billing-stop guarantee; binary MP3 path records bytes/request ID without complete usage. V/B absent. **BLOCKED**. |
| `gpt-live-transcribe`; app POST `/v1/realtime/calls`, multipart SDP and transcription session | D: $0.017/minute realtime audio duration. S3 lists transcription-session support; S4 describes transcription over WebRTC/WS, PCM 24 kHz, `languages`, and explicit commit. S5 describes WebRTC call creation. | L: owned reservation/run/connection, original lease deadline, trusted Location parser, queued stop and restart cleanup. Real dispatch rejected. | Exact multipart session/account acceptance, call identity, applicable hangup, server usage source, billing duration semantics/rounding and finite failure exposure remain unverified. V/B absent. **BLOCKED**. |
| Transcription call shutdown; POST `/v1/realtime/calls/{call_id}/hangup` | D: S6 describes terminating active SIP/WebRTC Realtime calls; it supplies no quantitative billing-tail guarantee. | L: provider ID only, 5-second hangup transport timeout, durable retry; successful HTTP response marks local `stopped`; 404/timeout remain uncertain. | Prove applicability to this transcription call and independently observe media cessation; reconcile billing separately. Local `stopped` is not a paid-cost certificate. **BLOCKED**. |
| Independent supervision for the same transcription model | No reviewed provider guarantee establishes a finite charge during loss of all application termination paths. | L: cleanup CLI restricted to loopback database; same-host sweeper and durable restart recovery only. | No independently surviving supervisor, provider-enforced deadline or bounded orphan-call recovery demonstrated. **BLOCKED**. |

### Sources

- S1: [GPT-4o Mini TTS](https://developers.openai.com/api/docs/models/gpt-4o-mini-tts).
- S2: [Create speech](https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create).
- S3: [GPT-Live-Transcribe](https://developers.openai.com/api/docs/models/gpt-live-transcribe).
- S4: [Realtime transcription](https://developers.openai.com/api/docs/guides/realtime-transcription).
- S5: [Create call](https://developers.openai.com/api/reference/resources/realtime/subresources/calls/methods/create).
- S6: [Hang up call](https://developers.openai.com/api/reference/python/resources/realtime/subresources/calls/methods/hangup).

S3's endpoint table and S4's transport guidance establish different levels of
detail; do not conclude that the app's exact request is either certified or
unsupported from the table alone. S4 supports the intended session configuration;
the exact exchange and subsequent call-control behavior remain external proof
obligations. Preserve the configured aliases; record resolved model identity when
the provider exposes it. S1 currently lists a dated default snapshot, which is
documentation evidence rather than evidence of a request this account executed.

### Code anchors checked

- [Runtime defaults](../../src/server/interview/runtime-configs.ts): chained
  transcription and speech model/voice selections; owned session snapshots remain
  authoritative for an individual run.
- [Speech generation](../../src/server/interview/turn-based.ts):
  `generateSpeechBuffer`, MP3 response, input truncation and timeout.
- [Transcription route](../../src/app/api/mobile/v1/interview/chained-coaching/transcription/route.ts):
  multipart exchange, `languages: ["en"]`, disabled turn detection, late-ID handling,
  no explicit timeout on the exchange fetch, and DELETE returning queued status.
- [Lifecycle](../../src/server/interview/transcription-lifecycle.ts) and
  [cleanup CLI](../../scripts/interview/transcription-cleanup.ts): original
  deadline, 2-second sweeps, 15-second freshness threshold, up to 20 claims for
  30 seconds, and 5-second hangup timeout. These are local scheduling parameters,
  not a worst-case provider termination bound.
- [Audio capability](../../src/server/interview/audio-safety.ts),
  [dispatch guard](../../src/server/interview/provider-budget.ts),
  [Realtime guard](../../src/server/interview/beta-safety.ts), and
  [audio accounting](../../src/server/interview/audio-accounting.ts): blocked
  paths, frozen tariffs, provider-only settlement and unresolved holds.

## 2. Cost-bound decision

For speech, a prospective bound would require
`C_max = ceil_microUSD(r_text * T_input_max / 1M + r_audio * T_output_max / 1M)`
with all billed components, provider-enforced quantities and applicable tariff
rounding established. The reviewed input limits do not establish
`T_output_max`. Therefore **no finite total speech bound is established** here.
Do not extrapolate audio tokens from character count, file size, playback time,
sample averages or the client's abort. Do not present the input-cost component
alone as a whole-request ceiling.

For transcription, a prospective bound would require a provider-defined maximum
billable duration `D_max`, including any setup, silence, disconnect and shutdown
tail that is billed: `C_max = tariff_round(r_minute * D_max / 60)`.
Whether duration means media processed or connected time, and how partial minutes
are rounded, must be established before applying the formula. The frozen app
deadline is not `D_max`; host/network/provider failures can prevent hangup.
**No finite failure-inclusive transcription bound is established** here.

Keep four quantities distinct: proven ceiling, estimated cost, measured usage,
and held reservation. A reservation constrains app admission, not the provider's
bill. A measured maximum is a sample result, not a universal bound. Successful
termination alone cannot settle cost. Missing/partial evidence remains unknown.

## 3. Independent supervision requirements

Before any future activation proposal, identify an independently surviving
control path with these properties, without selecting infrastructure in this
package:

1. Admission requires the supervisor to acknowledge ownership, original deadline
   and bounded termination responsibility before media can become billable.
2. Call identity and termination authority remain accessible when the application
   host or primary database is unavailable. Credentials never enter client payloads
   or evidence exports. Independent persistence must support eventual reconciliation.
3. Provider admission before durable ID storage has an explicit solution: a
   provider-enforced finite lifetime or independently recoverable call identity
   with a documented finite recovery bound. An in-memory catch/hangup is insufficient
   if the host dies. Do not assume call listing or idempotent creation exists.
4. Lost supervision denies new admission and triggers termination. Loss of the
   supervisor itself requires a surviving termination path or provider-enforced
   cap. Another worker on this PC does not meet host independence.
5. Bound detection, scheduling/backlog, dispatch, provider completion and billed
   tail separately. Unlimited retries or a successful HTTP response cannot prove
   a finite tail during provider/network outage.
6. Shutdown evidence and accounting evidence remain separate. Preserve original
   identities/deadlines across recovery; reconcile late evidence once, without
   releasing unknown holds or restarting audio automatically.

| Failure domain | Required surviving evidence/control | Current verdict |
| --- | --- | --- |
| Application host lost | Independent identity/deadline/credentials; observed shutdown within proved bound | BLOCKED: restart cleanup cannot operate during outage |
| Primary database unavailable | Previously acknowledged independent record; stop without database access; reconcile later | BLOCKED: current sweeper requires database |
| Supervisor lost | Another independent finite termination mechanism or provider cap | BLOCKED: none certified |
| Provider or network unavailable | Provider-enforced finite billable lifetime despite failed hangup | BLOCKED: no documented bound established |
| Crash after admission, before ID persistence | Recoverable provider identity or finite orphan lifetime | BLOCKED: in-memory recovery does not survive crash |

## 4. Future verification protocol — do not run yet

### Prerequisites and exposure policy

The future operator must have a separately approved record naming account/project,
isolated environment, operator, exact model/voice/request settings, dated tariffs,
approved generic audio fixtures and their hashes/permissions, evidence location,
and authorized observation window. No personal candidate material is needed.

That record must supply positive numeric micro-USD ceilings per operation,
session and whole experiment; numeric maximum billable seconds where applicable;
shutdown and observation deadlines; and a provider-billing reconciliation window.
None are chosen or authorized by this document. A missing value means DO NOT RUN.

Define `E_case` as the separately approved case ceiling, including setup, all
attempts and shutdown tail. One live case and one connection may run at a time;
no automatic retry. Before dispatch require a defensible worst-case bound that
fits `E_case` and the remaining experiment allowance including all unknown holds.
For every case below, maximum permitted exposure is **E_case**, never an observed
average or an unbounded exception. Currently every live case is blocked because
the required bounds are absent; maximum authorized spend in this package is $0.

Verified emergency termination must already exist for the exact path, independent
of the component being faulted. This cannot be bootstrapped by disabling app guards
and hoping an initial paid call can be stopped. Obtain provider guarantees or a
separately scoped, provider-controlled validation arrangement first. If that cannot
be established, record BLOCKED and retain all guards.

### Ordered cases

First review the prerequisite record and dry-run the procedure on paper. Then,
only in a separately authorized future runner/environment, execute these cases in
order. Every row uses E_case and the predeclared observation/reconciliation windows.
Faults such as omitted headers are injected at a controlled test adapter; label
them as injected, never as natural provider behavior. No runner is created here.

| Case / procedure | Required observation and pass rule |
| --- | --- |
| 1. Normal speech and transcription, tested separately | Exact request accepted; provider identity captured; explicit Done yields matched final item; approved speech remains full-file. Termination/media cessation and complete usage/billing reconcile within E_case. Transcript success alone fails the safety gate. |
| 2. Explicit End during active transcription | Owned stop queued once; independent observer confirms cessation within approved deadline; committed text remains saveable. A 202 stop response alone fails. |
| 3. Original deadline expires | Supervisor stops the call within proved tail; no deadline extension or new allowance; billed exposure remains within E_case. |
| 4. Disconnect then reconnect | Original attempt/deadline remain; no overlapping call or automatic capture restart; any separately authorized new attempt is independently reserved. Uncertain prior call blocks further dispatch. |
| 5. Delay exchange response until after End/deadline | Late ID is captured for shutdown, never returned as active; observer confirms cessation. Continued media or lost identity fails. |
| 6. Suppress/malformed Location; separately fail durable ID storage | Withhold admission to client; retain uncertainty; independent orphan control limits exposure even if the app is then lost. Local catch-only success fails host-loss proof. |
| 7. Duplicate stop requests and cleanup claims | No revived connection; stable ownership/deadline; no duplicate settlement. Observe provider results without assuming duplicate hangup semantics. |
| 8. Inject hangup timeout, 404 and provider/network outage separately | No false confirmed stop or zero-cost claim; retain durable work/hold; independent cap still limits exposure. No finite cap means fail and do not attempt the live fault. |
| 9. Lose application host while media continues independently | Supervisor operates without that host; observes shutdown within proved bound. A client on the failed host cannot serve as this test's independent media source. |
| 10. Lose primary database; separately lose supervisor | Surviving mechanism stops the call and retains evidence for recovery. Returning database/service availability is not the shutdown proof. |
| 11. Delayed, duplicate, partial and conflicting usage | Partial/missing usage retains holds; complete provider quantities settle once at frozen rates; duplicates never add cost; conflicting evidence triggers investigation and stops the experiment. Reconcile with billing before passing. |

After each case, stop new dispatch until termination and usage are resolved. On
unknown identity, missing observer, expired observation deadline, ceiling risk,
unexplained charge or any failed assertion: stop the experiment, invoke the
previously verified emergency mechanism, retain holds/evidence, and record failure.
Do not send a new probe to discover whether the old call is still billable.

### Evidence record and acceptance

For each case retain case ID, revision, model/voice and config fingerprint,
fixture hash, tariff version, operation/reservation linkage, numeric ceilings,
UTC event timestamps plus monotonic elapsed times and clock uncertainty,
fault injection details, request/termination status, independently observed media
cessation, provider usage components, billing interval/attribution, held/settled
amounts, and verdict. Missing data is explicit, not zero.

Keep provider call/request IDs in restricted operational evidence only; public
or economics exports use opaque case IDs and allowlisted metadata. Do not export
credentials, SDP, raw audio, transcripts, resumes or prompts. An independent
observer must expose the exact termination/usage signals it relies on; no suitable
signal means inconclusive. Aggregate billing that cannot be attributed to the
case cannot establish per-case reconciliation.

A case passes only when its expected behavior, finite exposure bound, observed
termination and complete attributable billing evidence all pass. Local mocks can
verify state-machine behavior only. Observations corroborate provider guarantees;
they do not create universal caps. Any failed/inconclusive case keeps its gate
blocked. Passing this protocol would still require a separate reviewed activation
change and the other gates in the [remaining-gates register](INTERVIEW_V1_REMAINING_GATES.md).

## 5. Decision and next bounded package

**2026-09-12 superseding direction:** the user deferred provider support
clarification. Omit it from the immediate work sequence; no further support
follow-up is planned. The proposal below is retained as historical rationale,
not a prerequisite for independent local work. Existing live safeguards remain;
any revised paid-test risk policy requires its own scoped decision.

Follow-up: the [provider clarification packet](INTERVIEW_VOICE_PROVIDER_CLARIFICATION.md)
contains the 2026-09-10 research findings and submitted support request. The
60-minute Realtime maximum is a documentation lead whose transcription billing
applicability remains unresolved. Support clarification is now deferred.

**Decision: preserve blocked activation.** The documentation package is complete;
the provider guarantees and live evidence are not. No runtime, API, schema,
configuration, credential, model or tariff changes were made.

The smallest next package is **provider guarantee clarification**, before a new
supervisor implementation or paid runner. Prepare a concise request for exact
TTS output/billing caps; transcription multipart WebRTC compatibility and trusted
call identity; applicable hangup and billing-tail semantics; duration rounding and
server usage access; and finite lifetime/orphan recovery during total control-path
loss. Seek official documentation or written provider confirmation with scope,
model and date. Sending that request requires explicit authorization; this package
does not contact support.

Accept that follow-up only when each question has a sourced answer or explicit
unresolved outcome. Unsupported answers leave activation blocked. If sufficient
guarantees become available, separately design the independent supervisor and
disabled test harness around them, then propose a numeric live-test budget.
Do not substitute models or relax the proof standard to manufacture completion.

Documentation acceptance: source/code cross-check, local-link validation,
whitespace review and a before/after repository-file hash comparison. Existing
application test/build evidence remains historical; no application suite, paid
call, device operation, database change, deployment, commit or push is part of
this documentation milestone.
