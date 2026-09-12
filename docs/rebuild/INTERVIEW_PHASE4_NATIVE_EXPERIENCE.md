# Phase 4 native experience — execution contract

P4.1 begins at clean local checkpoint `8b6926f`. The approved roadmap and
execution ledger control sequencing. This first slice is screen alignment,
not prompt promotion, Done-answering behavior, audio latency proof or release.

## P4.1 frozen decisions

- Shared portable colors/spacing/radii/type/touch constants live in
  `packages/interview-contracts/src/design.ts`; native tokens re-export these.
  Existing framed preview consumes the same color variables. No new app or
  standalone test bed. No dependency/schema/provider changes required.
- Graphite surfaces, cyan primary actions, lime progress/evidence accents.
  Native scalable system typography, wrapping text, minimum48 touch targets,
  growing button labels, restrained pressed states, readable error/empty states.
- Home: real preferred name, quick-practice action only for available mode,
  active target, latest actual review/score, honest recent-session count. Never
  call a bounded bootstrap sample an all-time total or fabricate recommendations.
- Practice: target -> catalog mode -> focus only when required -> interviewer
  style -> explicit start. A mode-selection hero uses honest setup copy, not a
  fabricated recommended question or microphone instruction before connection.
  Preserve server configuration validation, catalog gating and engine routing.
- Me: named accessible fields, comfortable multiline job description, existing
  save/profile/target APIs, explicit save/error state, truthful resume status.
  No new resume upload, auth redesign, account deletion or preparation tools.
- History/Review: preserve Phase3 direct detail, polling/retry locks and evidence
  before scores. Align surfaces/typography/taps; preserve assisted labels.
- Live: retain actual phase/status, mute/captions/End semantics. Align fullscreen
  shell without changing WebRTC, automatic submission, playback or persistence.
  Behavior improvements are P4.2 onward; do not silently bundle them into styling.
- Tab safe area belongs to the navigator; scroll content retains top/side edges.
  Forms get keyboard avoidance/dismissal and persistent taps. Fullscreen live
  screens retain their own bottom inset and End control.
- Browser design-only screens must say sample/simulated. User-facing controls
  stay in mirrored iPhone/Pixel frames. Default remains Test Coaching/no audio,
  Fit, Simulation with no automatic mutations/provider calls.

## Gates

Manager review, root/mobile typecheck and lint, shared contracts, native component
tests, complete Interview/mobile suites, headless small/large frame captures.
Run a local Android compile only (no emulator launch/install or desktop control).
Keep native compilation distinct from executing the new UI on a physical phone.

Native keyboard, screen-reader, large text on hardware and real voice/player
tests remain operator gates. P4.2-4.6 are not accepted by this visual slice.

## P4.1 acceptance evidence — 2026-09-06

Accepted for local automated implementation. The manager reviewed the native
diff: connection/recording/transcription/evaluation handlers are unchanged.
Live controls now sit outside scrollable content; this does not change when a
turn is submitted or how audio is played. That work starts at P4.2.

- `npm run test:interview:all -- -- --workers=2`: passed. Readiness41 pass/
  2 manual warnings/0 failures; root typecheck/lint and service/candidate gates
  passed;28/28 browser tests. Log:
  `artifacts/implementation-2026-09-06/p41-interview-final-pass.log`.
  Extra npm separators forward the two-worker limit to the existing runner;
  no suite, assertion, timeout or retry policy was weakened.
- Mobile typecheck and `npm run test:mobile`:11 contract tests, mobile
  authentication/ownership/history services and50 native tests in13 suites
  passed. Logs: `p41-mobile-typecheck.log`, `p41-mobile-final.log`.
  Mobile lint exits0 with26 warnings, primarily existing/test mock import style.
  See `p41-mobile-lint.log`; lint warnings are not claimed fixed.
- Local `gradlew.bat :app:assembleDebug -PreactNativeArchitectures=x86_64
  --max-workers=2 --console=plain`: BUILD SUCCESSFUL,513 tasks,44 executed.
  `p41-android-compile.log` retains Gradle deprecation/CMake path warnings.
  APK: ignored `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`.
  No install, emulator launch, physical device or signed-release proof.
- Expo SDK57 Android export passed: ignored Hermes bundle under
  `artifacts/implementation-2026-09-06/p41-android-export/`;
  log `p41-android-export.log`. No provider calls are needed for bundling.
- Manager inspected captured Home, Practice (top/scrolled), Live, Review and
  Me frames at393/412 phone widths. Headless checks assert no horizontal
  content overflow and minimum48 button heights, mirrored choices/profile,
  conditional focus, matching evidence expansion, and no learner mutations.
  Images are in ignored `artifacts/interview-regression/playwright-results/
  mobile-layout-sample-scree-96a73-ths-with-reachable-controls-{project}/`.

### Native / framed parity checklist

| Surface | Implementation evidence | Remaining operator evidence |
| --- | --- | --- |
| Home | Catalog-gated First Impression, actual active target/latest score, recent count, wrapping metrics; screen tests | Native large text and screen-reader traversal |
| Practice | Target/mode/conditional focus/style/explicit start; no question invented before launch; selection does not create a session | Native phone interaction and focus order |
| History/Review | P3 recovery/evidence/provenance tests retained;48-unit evidence/back/transcript actions | Native long-review scrolling and assistive navigation |
| Me | Named fields, saving lock, distinct error/success, honest parsed-resume status; mirrored sample edits never persist | Native keyboard and return-key behavior |
| Live | Shared fullscreen safe-area/header/scroll/footer; End outside scrolling captions; lifecycle tests retained | Real microphone/player/interruption behavior |

The browser samples remain design-only, with explicit sample notices. The real
default remains the framed **Test Coaching · no audio**, Fit, Simulation test
bed. Never infer native rendering or voice quality from these browser images.

### Worker/review record and superseded checks

Luna/medium handled bounded Home/Me then preview/test files. One preview
correction round left incomplete conditional controls/evidence linking; the
manager took over, aligned the setup cards, completed mirrored profile/save
disclosure and sample mute/captions, and strengthened/rendered the tests.
No measured token/cost saving is claimed.

The initial full run overlapped preview edits and emitted HMR errors:21/26
browser tests passed (`p41-interview-final.log`). It is not acceptance evidence.
New layout tests initially used a removed RNTL unsafe query and later needed
HTMLElement narrowing for Playwright's mixed element type; both were corrected.
The fresh frozen-source full gate above passed with two workers. Earlier
`p41-interview-accepted.log` ended at that TypeScript test error, despite its
filename, and must not be mistaken for the accepted run.

## P4.2 starting scope

Implement bounded transcript accumulation and explicit Done-answering
finalization in the existing Coaching path. Test acknowledgement/late-event
ordering without paid calls or real audio. Do not promote candidate prompts,
enable another engine, or claim latency/device proof from P4.1.

## P4.2 contract — explicit answer finalization

- Scope: native chained Coaching, including spoken Ask Que clarification.
  Mock Interview and other Realtime routes retain their existing turn policy.
- Transcription uses manual commits (`turn_detection: null`). Pauses and
  transcript deltas never advance the exercise. Done answering disables the
  microphone and sends one commit; End & save remains a separate session action.
- Accumulate caption deltas by input item ID. Submit only after the committed
  item acknowledgement and its authoritative final transcript both arrive,
  allowing either order. Never substitute a partial delta for a missing final.
- Duplicate Done, acknowledgements, completions and old item events must not
  create another turn. One outstanding commit is allowed per transport.
- Failure/timeout stops capture and offers recovery without submitting partial
  text. An uncertain transport is closed before reconnecting; re-answer the
  same question without replaying the opening or silently generating feedback.
- Clear the input buffer before accepting speech for the next answer. End,
  backgrounding and unmount invalidate pending finalization and late events.
- Framed Live Session is a labelled simulation of Done/finalizing/End; both
  phones mirror it. The typed inspector already submits only on an explicit
  action. Its Simulation/no-audio default and learner-data separation remain.
- Acceptance needs native event-sequence tests, mocked transcription settings,
  complete Interview/mobile gates, mobile lint/typecheck, frame inspection and
  local native compilation. Real WebRTC audio delivery at the Done boundary,
  permissions, voice quality and iPhone installation remain device checks.

Protocol reference: [Realtime transcription](https://developers.openai.com/api/docs/guides/realtime-transcription),
checked 2026-09-08. The current gpt-live-transcribe request uses `languages`
instead of the singular `language` field, as required by that model.

P4.2 accepted locally on 2026-09-08: 65 native tests, 11 contracts, service gates,
28 browser tests, root/mobile typechecks and lint, Android debug compile and
Hermes export pass. Exact logs, manager completion and manual exclusions are
recorded in `INTERVIEW_EXECUTION_STATUS.md`. Resume at P4.3.

## P4.3 frozen execution scope — 2026-09-08

Baseline: `64344c1` on `codex/interview-mobile`, with accepted P4.2 and
documentation edits still uncommitted. Preserve them. This slice applies to
native chained Coaching and labelled mirrored design samples; other Realtime
modes retain their existing policies until their own mode work.

| State | Learner controls and microphone behavior |
| --- | --- |
| Connecting/preparing | Microphone off until P4.2 clear acknowledgement; Type instead and End available |
| Listening | Explicit microphone-on or microphone-muted status; Mute/Unmute, Done answering, Type instead, End |
| Finalizing | Microphone off; wait for the matched final transcript; no input-mode change or second submission |
| Processing | Microphone off; explicit processing status; no new answer while a request is unresolved; End available |
| Speaking | Microphone off; Que speaking is distinct from learner recording; End available |
| Choice | Microphone off; Try again, More feedback, Ask Que, Move on; End available |
| Typed fallback | Microphone transport closed; current validated question/feedback visible; explicit Send answer or Send question |
| Recoverable failure | Existing operation-specific retry; text fallback only for connection/transcription or cached playback result, never a new answer after uncertain generation |

- Captions/history start collapsed. Current text in fallback must remain usable
  without expanding historical captions. Learner screens omit pipeline debug cards.
- Mute controls the learner microphone, not Que's volume. Preserve already
  buffered speech and mute preference until explicit unmute; Done remains the
  only voice commit. Never display an active recording indicator while muted.
- Type instead is a persistent fallback for this session. Close/invalidate the
  transport immediately, discard uncommitted partial speech, and do not silently
  reconnect. Late microphone permission grants must stop their tracks.
- If the opening has not been requested, typed fallback requests it once. Typed
  answers and Ask Que use the existing turn contract, indices and choice intents.
  Empty input is rejected; duplicate taps cannot create another request. Unsent
  drafts are not added to the saved transcript.
- Text fallback skips client playback and presents the validated result. The
  existing server can still generate TTS; this is not a no-TTS-cost optimization.
  Read response instead after playback failure uses the cached validated result
  without another model request. Provider contracts/configuration stay unchanged.
- Backgrounding/interruption/End retain the existing stop-and-save policy and
  invalidate late work. Restart/spool expansion belongs to P4.6.
- Browser samples share phase/input/captions/mute state across both phones, are
  explicitly simulated, and never call a provider or persist learner data.
  Test Coaching/no audio, Fit, Simulation remain the initial/reset defaults.

Acceptance: native mocked lifecycle tests (including permission denial, late
grant, duplicate send, Ask Que, mute/clear acknowledgement, old transport events,
uncertain response and cached playback recovery); complete Interview/mobile
gates, typecheck/lint, small/large headless frame inspection, Android compilation.
Physical microphone, native keyboard/assistive interaction and heard playback
remain unverified operator gates. P4.4 telemetry/latency and prompt promotion
are excluded.

Worker: Terra/medium for the bounded native component/tests; manager owns this
contract, browser simulation, integration review and acceptance. One correction
round before manager takeover; no per-agent cost attribution is available.

P4.3 accepted locally on 2026-09-08:77 native tests (33 Coaching),11 contracts,
API/service gates,30 browser tests, final typechecks/lint, Android debug compile
and Hermes export pass. The ledger records the worker correction, manager
guard/pause-order fixes, earlier test timeout and interrupted build separately.
Native/framed parity covers phase/mic status, collapsed historical captions,
current readable response, typed answer/Ask Que and reachable Send/End. Browser
state selection is a labelled design sample, not native transport evidence.
Keyboard, real audio/interruption and iPhone installation remain unverified.
Resume P4.4; no automatic paid/device test or prompt promotion follows.

## P4.4 execution contract — stage telemetry

- Scope: chained native Coaching and existing Interview inspection exports;
  no engine/prompt/provider selection change, streaming playback, paid requests,
  migrations or device test. Preserve accepted P4.2/P4.3 and dirty worktree.
- Additive, versioned, bounded diagnostic contract in shared Interview contracts.
  `artifact.coachingTelemetry` stores up to200 observations in existing JSON;
  old artifacts and clients remain valid. No transcript/prompt/audio is copied
  into telemetry. Diagnostics are client-supplied, not billing or authorization.
  Dropped observations are counted; invalid offsets/runtime metadata are omitted
  so instrumentation cannot poison an otherwise savable artifact.
- Client stages use one monotonic clock per observation: Done/typed Send,
  matching final transcript, request dispatch, response received, playback
  requested, first player status reporting playing plus positive currentTime.
  Player position is an observed proxy at the existing update interval, not
  proof of sound heard through the selected speaker. Do not time from play().
- Server request-local monotonic stages: actual model fetch start/body end,
  validation complete, TTS fetch start/first nonempty body chunk/full body end,
  response ready. First byte observes the stream while preserving full-file
  playback; it does not implement P4.5. Missing stages remain absent on failures.
  Validation checkpoint includes work between model-body completion and final
  validated artifact; it is not a pure validator CPU benchmark.
- Server stages have their own origin. Never subtract a server timestamp from
  a phone timestamp. Application request ID is returned in the header/body;
  available model/TTS provider IDs remain separately labelled. Replayed and
  deterministic turns do not invent fresh model timings.
- Opening, voice answer, spoken clarification, typed answer/question and choice
  are distinct. Failures persist; each recovery gets a new linked observation.
  Duplicate/late callbacks cannot duplicate a stage or mutate finalized snapshots.
  No successful baseline may silently omit failure/recovery denominators.
  Playback completion without a positive position is `audio_unobserved`; a
  later playback error supersedes `audio_observed` with a retained failed sample.
- Local report groups eligible fresh voice-answer observations by model/voice
  and a required declared device/OS/build/network/evidence profile. Use nearest-
  rank P50/P95; exclude recovery, replay, typed/choice/opening, incomplete and
  out-of-order samples. Report exclusions/outcomes/recoveries and sample counts.
  Empty input reports no baseline, never zero-ms latency. Mocked profiles cannot
  substantiate device performance. No latency target is accepted by this slice.
- Existing admin inspection JSON includes diagnostics; existing export supports
  `?format=json` behind the same admin guard. CSV remains compatible. Report
  input can be that JSON, a finalized artifact, or a pending-artifact envelope.
  Export is bounded to the existing recent100 sessions, not all-time history.
- CLI: `npx tsx scripts/interview/report-coaching-latency.ts INPUT.json
  PROFILE.json REPORT.json`; output must be a new file. A profile requires
  `evidence` (`mocked` or `device_observed`), `device`, `os`, `build`, `network`.
  Use ignored artifacts for local reports. Do not mix devices/networks/builds
  in one declared profile. Saved diagnostics depend on artifact finalization;
  crash-before-save durability remains P4.6.
- Gates: stage/percentile/compatibility tests; mocked server success/replay/error
  and owned artifact round-trip; native event-sequence assertions; complete
  Interview/mobile suites; typechecks/lint; Android compilation and Hermes export.
  No learner UI changes: existing framed regression coverage must remain green.
- Worker: Terra/medium native recorder/component tests, one correction round.
  Manager owns shared contracts, server instrumentation, report, persistence,
  docs and final review. Serialize final checks after all writers freeze.

P4.4 accepted locally on 2026-09-08:15 contract/timing tests,87 native tests,
32 browser tests, service gates, typechecks/lint, Android debug compilation
and Hermes export pass. Full evidence and corrected failed runs are recorded
in the execution ledger. Only synthetic report math has been measured; no real
device baseline exists. Resume P4.5 without automatic paid/device testing.

## Documentation checked before native edits

- [Expo SDK57 reference](https://docs.expo.dev/versions/v57.0.0/)
- [SDK57 safe-area-context](https://docs.expo.dev/versions/v57.0.0/sdk/safe-area-context/)
- [React Native KeyboardAvoidingView](https://reactnative.dev/docs/keyboardavoidingview)
- [React Native ScrollView](https://reactnative.dev/docs/scrollview)

Use the installed SDK57/RN0.86 types as the implementation constraint. No SDK
upgrade or dependency installation is implied by consulting documentation.


## P4.5 local spike decision

See [the P4.5 spike contract](INTERVIEW_P45_STREAMING_SPIKE.md) for implementation,
installed Expo57 source evidence and later operator steps. Accepted locally on
2026-09-08:96 native tests,15 contracts,32 browser tests, service/fixture gates,
typechecks/lint, Android debug build and Hermes export pass. The execution ledger
records all evidence and corrected initial failures.

Progressive HTTP is supported at the player API level. Physical approved-TTS
playback and latency benefit remain unmeasured, so learner Coaching keeps the
full-file path. The development harness is disabled by default, validates the
whole response before playback, and tests stop/release/explicit file fallback.
Spoken choice menus are shortened; full feedback/questions and visible choices
remain. No reusable generic cache is enabled. Resume P4.6 without automatic paid
calls, device control, audio playback or deployment.


## P4.6 local acceptance and Phase4 handoff

P4.6 is locally accepted on 2026-09-08. See
[the recovery contract](INTERVIEW_P46_RECOVERY_CONTRACT.md) and execution ledger
for checkpoint/account/restart guarantees, coverage, final logs and corrected
failures.117 native tests,15 contracts,32 browser tests, services/typechecks/lint,
Android debug build and Hermes export pass. All local Phase4 packages are now
accepted; stop at the requested handoff before Phase5 First Impression.

Physical microphone/speaker, process-kill/disk/reopen, interruption, iOS install
and latency evidence remain open operator gates. Full-file learner playback and
unpromoted candidate prompts remain. Checkpoints contain committed text only,
not partial speech/audio, and cannot guarantee work after the last successful
write. Other Realtime modes are not certified by chained Coaching coverage.
