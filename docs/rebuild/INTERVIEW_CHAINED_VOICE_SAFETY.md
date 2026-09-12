# Chained voice safety: local implementation

Date: 2026-09-10. Scope: approved local follow-up to Phase7, QuesIQ-dev only.
The execution ledger owns final acceptance. Existing models, explicit Done,
full-file playback and Phase4-7 work are preserved. No live activation is implied.

The [activation proof package](INTERVIEW_CHAINED_VOICE_ACTIVATION_PROOF.md)
records the 2026-09-10 documentation review, unresolved provider guarantees and
future verification procedure. Documentation is complete; live gates remain blocked.

## Capability and activation report

| Path | Billing evidence | Implemented safeguard | Activation status and missing evidence |
| --- | --- | --- | --- |
| Native gpt-live-transcribe | Official model page lists realtime audio duration per minute | Durable owned connection/reservation/deadline, stop queue, restart cleanup, unknown holds | Blocked: verify exact transcription endpoint compatibility, provider call identity, hangup behavior, independently surviving supervision, server-observed usage and worst-case billed duration during failures |
| gpt-4o-mini-tts / marin | Text input and audio output tokens; API input limit does not establish output spending cap | Explicit frozen audio units; model capability blocks dispatch | Blocked: no defensible hard output-cost bound established; keep model unchanged |
| Legacy gpt-4o-mini-transcribe file input | Provider response can identify audio/text input tokens and output tokens | Parse only explicit usage components; missing detail stays unknown | Blocked: input validation/bounds and reviewed explicit unit tariffs need separate proof |
| Legacy tts-1 | Character billing is a distinct unit from tokens | Recognized separately, blocked | Not activated or selected as a replacement; legacy path review remains open |
| Full Realtime interviewer | Outside this package | Existing Phase7 activation block preserved | Separate server-control and paid-validation package |

Official sources reviewed (2026-09-10):
- [Live transcription model](https://developers.openai.com/api/docs/models/gpt-live-transcribe)
- [Legacy character billing](https://developers.openai.com/api/docs/models/tts-1)
- [Speech model](https://developers.openai.com/api/docs/models/gpt-4o-mini-tts)
- [Speech request fields](https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create)
- [Transcription usage shape](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create)
- [Server hangup for SIP/WebRTC](https://developers.openai.com/api/reference/python/resources/realtime/subresources/calls/methods/hangup)

Documentation is not account/endpoint/live verification. No real tariffs, budgets,
credentials or activation settings were installed. Test rates are synthetic only.

## Lifecycle and recovery

Before a managed connection dispatch, server state must establish an owned session,
a started transcription AI run, a reserved operation and its existing unexpired
account lease. The connection copies that original deadline; retries cannot
re-dispatch the same attempt, overlap an open session connection, or reset time.
A partial unique index and the Phase7 transaction lock serialize admission.

The provider Location supplies the call ID; clients never supply a trusted call ID.
Missing IDs and ambiguous exchanges remain unresolved. A late exchange after a stop
cannot return an active connection. If ID persistence fails after admission, the
route attempts hangup using the in-memory provider ID and retains uncertainty.

The authenticated DELETE transcription endpoint accepts sessionId only and queues
an owned stop. Its202 response means stop_requested, not confirmed termination.
Native cleanup queues this stop once for a managed connection, including late SDP
responses after unmount. Server artifact completion also queues shutdown. Existing
pending-save/confirmed-save/deferred-review behavior remains authoritative; server
cleanup failure does not undo a successful artifact save.

The local cleanup command is `npm run interview:transcription:cleanup`; append
`-- --watch` for repeated sweeps. It is deliberately not installed or launched as a
background service. A restart conservatively stops all prior open connections.
Normal sweeps stop expired, ended or stale-supervision connections. The worker
checks every2 seconds, recognizes a15-second supervision gap and claims at most20
termination jobs for30 seconds; hangup requests have a5-second transport timeout.
Failures retain durable retry work and reservations. Only a successful provider
response marks termination confirmed;404/timeouts do not. Synthetic records require
an injected mock transport and never enter the real worker population.

Worker freshness is not provider/media supervision or a hard dollar guarantee.
While the host is down it cannot issue hangup. No sideband usage observer, independent
host-failure terminator or paid failure rehearsal is certified here. Those gaps are
why live transcription stays blocked even with this local lifecycle implementation.

## Audio accounting and exports

Additive migrations0096-0097 add lifecycle records and optional explicit audio
billing components to pricing. The pre-change local backup has a readable760-entry
index; a restore rehearsal is still outstanding. Only loopback5433/quesiq_local
was migrated. No existing historical usage was reconstructed.

New audio runs freeze units, rates and pricing version. Duration, characters,
text input/output tokens and audio input/output tokens are distinct. Legacy generic
token rates never silently price an audio component. Unsupported/missing components
remain null. Provider file-transcription usage is parsed without guessing missing
details; existing binary speech responses have unavailable usage. Server-only
recording accepts quantities/provenance, never replacement tariff inputs.

Complete provider evidence may settle once; modeled or incomplete outcomes retain
reservations. Termination alone never establishes cost. Later tariff edits cannot
rewrite the run snapshot. Late duplicate final usage does not charge twice.

The existing economics command includes audio units/coverage and current unresolved
connections. Its date/account/mode filters and default synthetic exclusion apply;
older unresolved connections stay visible without inflating active-user counts.
JSON contains allowlisted metadata; CSV adds audio columns and emits a companion
`<csv-path>.connections.csv`. No call IDs, transcripts, prompts, resumes, audio or
credentials are exported. The empty fixture report is not a real economics baseline.

## Verification and next gate

Run `npm run test:interview:voice-safety` for independent audio unit checks and real
local-DB lifecycle tests with mocked providers. It is included in the full Interview
gate. Full Interview/mobile, static, Android build, Hermes and headless phone preview
evidence belongs in artifacts/voice-safety-2026-09-10 and the execution ledger.

The authorized fallback is delivered: unsupported live paths remain blocked with
specific gaps. Local tests cannot replace the next separately scoped provider
termination/cost-bound proof, paid quality/economics or physical-device testing.
