# P4.6 recovery and handoff contract

Scope: local Interview mobile recovery in QuesIQ-dev, codex/interview-mobile.
Preserve accepted P4.2-P4.5 and earlier documentation changes. No deployment,
provider calls, device/desktop control, schema migration or dependency change.

## Recovery behavior

Chained Coaching emits a detached checkpoint on phase/committed-turn changes
and every five seconds while active. Only committed transcript, events and
bounded telemetry enter the checkpoint. Partial speech and raw audio do not.
The restart copy ends as connection_lost; pending timing observations are marked
interrupted in the copy without mutating the live recorder. End still produces
one final artifact. A restart recovers saved work; it never reopens a microphone
or resumes an uncertain live conversation.

The live route stages account/session-bound records in the app document directory.
Each update writes and reads back a fresh temporary generation, moves it to a new
committed filename, then removes older copies. It never overwrites the sole valid
copy. Generation ordering survives a backward wall-clock adjustment. Failed
writes/moves preserve the previous checkpoint; corrupt latest records can fall
back to a previous valid generation. A four-million-character payload cap and
validated identifiers/contracts bound accepted records. Unknown fields are stripped.
These are mocked filesystem/API guarantees, not fsync or physical-crash proof.
A checkpoint-write failure produces a live backup warning; final save still
attempts local staging and server persistence.

On sign-in, foreground or reconnection, recovery skips the current live session
and other accounts' bound records. Account changes abort the recovery request and
prevent pending-copy deletion. Active session state is account-bound and is
cleared across account changes, so signing back in cannot revive old capture.
Legacy unbound copies require an owner-checked server detail lookup before
staging under an account or transmitting transcript. Foreign/not-found legacy
copies remain on disk. Corrupt records are retained for diagnosis, not guessed.

Live save and recovery share a per-account/session single flight. Recovery checks
server detail before PUT: matching already-saved transcripts reconcile lost
acknowledgements; conflicting transcripts stay pending and never overwrite the
server artifact. Pending copies are removed only after successful reconciliation
or persistence. Failed/processing evaluations are left to the saved-review flow;
recovery does not bypass explicit evaluation retry confirmation. Empty interrupted
sessions save without requesting evaluation. A retained-record notice offers
Retry saved sessions; live save also offers Open saved session after server
acknowledgement even when review creation needs attention.

## Audio and lifecycle

Existing explicit Done, microphone clear acknowledgement, partial-transcript
discard, permission retry, late grant/response, double End and background behavior
remain. Added coverage verifies NetInfo loss and audio-service reset each finalize
once and stop capture, plus detached checkpoints that cease after End.

Startup/foreground recovery, while no session is active, cleans only expired
Coaching/spike temporary audio filenames older than24hours. Recent, unknown and
other-product files are untouched. Existing player cleanup still removes current
files at normal boundaries; OS cache eviction remains a fallback after failures.

## Verification and handoff limits

The worker assignment was Terra/medium, native lifecycle test file only. Manager
reviewed the tests and implemented persistence, account/restart handling, save
screen coverage and documentation. No measured per-agent cost attribution.

Automated gates: shared contracts, mobile API/auth/history, native controller/
component/file-spool tests, typechecks/lint, full Interview headless regression,
Android debug compilation and Hermes export. The execution ledger records final
counts, logs and any corrected failed runs; it is the acceptance authority.

The five-second checkpoint can lose work after the last successful checkpoint,
and disk failure can leave an older copy. Physical OS termination/power loss,
native audio interruption, microphone/speaker behavior, iOS signing/install and
real reopen/save proof remain separately authorized operator gates. Other
Realtime modes retain their finalization behavior for Phase5 work; continuous
Coaching checkpoints do not certify those modes.

After local acceptance, hand off at Phase5's First Impression work package.
Do not start another phase, paid quality screening, streaming promotion or
device test merely to produce the handoff. Keep Test Coaching/no audio, Fit,
Simulation as the framed default. P4.5 streaming stays an opt-in development
spike and learner playback stays full-file.
