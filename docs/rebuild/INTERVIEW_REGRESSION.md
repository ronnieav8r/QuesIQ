# Interview Local Regression System

Last updated: 2026-09-10

This is the canonical local test guide for QuesIQ Interview. The gate is
Interview-only; Study, DPE, NCLEX, Quira, Render, and production traffic are
outside its scope.

## Command Family

### Phase6 preparation, priorities and evidence

`npm run test:interview:preparation`, `npm run test:interview:questions` and
`npm run test:interview:progress` are included in the full Interview gate.
They use isolated loopback database owners and mocked provider boundaries.
Progress services exercise explicit provenance, initial/guided/repeated work,
attributable review evidence, matching rubric/model/target comparisons,
latest20/90day recommendations, dismissal replay/expiry and stale launch checks.
Loading evidence never invokes a provider. Legacy web queue/artifact replay and
saved-preparation ownership are covered alongside the native contracts.

Native `test:mobile` includes preparation/file-picker cancellation and account
changes, Story Lab drafts/manual saves, saved-question route refocus and useful
progress/recommendation lifecycle tests. Physical picker/keyboard/assistive input,
spoken audio and paid AI quality remain separately unverified. Browser specs
`phase6-preparation`, `phase6-story-lab`, `phase6-questions`, `phase6-progress`
check read-only shared samples inside both phone frames. They do not certify
native rendering or physical hardware. See INTERVIEW_PHASE6_CONTRACT.md.

### Phase5 four-mode local acceptance

`scripts/test/phase5-services.ts` runs inside the default execution-service gate
with isolated owner records and intercepted provider boundaries. It covers FI
one-retry/replay and owned saved review; Rapid Fire1-10 controller bounds,
no mid-run feedback, exact question pairing/early-end eligibility and legacy
Realtime preservation; Mock pinned model/policy, legacy behavior and review gates.
`tests/interview/phase5-modes.spec.ts` exercises FI/Rapid Fire in both phone frames
on desktop/mobile, with Coaching still the default on fresh load. Native Mock
lifecycle tests cover late permissions/events, background, detached checkpoints,
bounded finalization and delayed follow-ups. These are not physical-audio tests.

Browser concurrency now defaults to two workers. The equivalent explicit command
is `npm run test:interview:all -- -- --workers=2`; neither assertion timeouts nor
assertions were weakened. Avoid overlapping this gate with a full native rebuild
on a busy host; preserve failure traces and rerun after contention has ended.
Final Phase5 gate additionally compiles Android debug and exports an Android
Hermes bundle; neither installs or starts an emulator/device.

The explicit Realtime Model Lab variant `native_mock_v1` resolves the same new
local Mock policy for Mock scenarios only. `production_v1` still inspects the
historical prompt. This is opt-in paid tooling, not part of the default gate;
Phase5 only ran deterministic composition/variant tests. No provider comparison
or Mini promotion is implied. See `INTERVIEW_PHASE5_CONTRACT.md` for activation.

Run from:

```powershell
E:\Codex\QuesIQ\QuesIQ App Worktrees\QuesIQ-dev
```

```powershell
npm run test:interview:static
npm run test:interview:services
npm run test:interview:e2e
npm run test:interview:live-ai
npm run test:interview:all
```

- `test:interview:static` runs Interview readiness, TypeScript, and ESLint.
- `test:interview:services` seeds deterministic local Interview records and
  verifies database persistence.
- `test:interview:e2e` starts an isolated Next development server and runs the
  desktop Chromium and Pixel-sized mobile browser matrix.
- `test:interview:live-ai` exercises the real turn-based Interview model path.
  It is opt-in and separate from the deterministic default gate.
- `test:interview:all` runs static, service, and E2E checks in sequence.

## Required Local State

- Node and npm versions satisfy `package.json`.
- Dependencies are installed from `package-lock.json`.
- Docker Postgres is healthy on the `.env.local` `DATABASE_URL`.
- Local migrations are current.
- Playwright Chromium is installed.

Typical setup:

```powershell
npm ci
npm run playwright:install
npm run db:local:up
npm run db:local:migrate
npm run test:interview:all
```

## Isolated Browser Server

The Playwright configuration is `playwright.interview.config.ts`. It uses:

- default URL `http://127.0.0.1:3210`
- override variable `INTERVIEW_E2E_PORT`
- Next output directory `.next-interview-e2e`
- `E2E_TEST_MODE=1`
- `DEV_AUTH_BYPASS_ENABLED=1`
- `E2E_AI_MODE=mock` by default

The wrappers are:

```text
scripts/test/interview-e2e-runner.mjs
scripts/test/interview-e2e-server.mjs
```

They restore Next-generated `next-env.d.ts` and `tsconfig.json` changes after a
normal test run. If a run is interrupted, confirm those files are clean before
committing.

## Seeded Test Data

The seed and service harness is:

```text
scripts/test/interview-regression.ts
scripts/test/interview-services.ts
tests/interview/global-setup.ts
```

Disposable rows use the prefix:

```text
[TEST_DELETE] Interview Regression
```

The seed creates one local E2E admin user plus Interview-owned records for:

- a job target
- a custom Question Queue question
- a saved story
- a saved introduction
- a deterministic Rapid Fire session

Cleanup is scoped to the seeded E2E user and Interview-owned tables.

## Browser Coverage

The browser specification is:

```text
tests/interview/interview-regression.spec.ts
```

It verifies:

- local root-to-Interview automatic dev entry without OAuth or a login screen
- authenticated Interview shell navigation
- Coaching, Rapid Fire, Mock Interview, and Hands-Free setup cards
- Story Lab, History, and Me rendering
- profile/job-target, Question Queue, story, and introduction APIs
- custom question create, update, and delete
- admin Interview test-tunnel readiness
- desktop and mobile layouts
- no unexpected browser console or failed-response errors

AI-adjacent browser behavior is mocked by default. The E2E gate does not spend
API credits or claim to verify real microphone, speaker, or Realtime quality.

## Realtime Model Lab

The Realtime Model Lab compares the production-composed Interview prompt with
scripted text input, without microphone capture or emulator control. Results are
stored as `realtime_model_test` rows in `ai_runs` and written to ignored JSON and
CSV reports under `artifacts/interview-realtime-model-lab/`.

Run the deterministic parser and cost tests without making API calls:

```powershell
npm run test:interview:realtime-model-lab:unit
```

Run the default Mock Interview scenario against GPT-Realtime-2.1,
GPT-Realtime-2.1 Mini, GPT-5.4, and GPT-5.4 Mini using text input and text
output. The GPT-5.4 baselines use the Responses API with the same composed
prompt and scripted turns:

```powershell
npm run smoke:interview-realtime-models
```

Capture the transcript of the response generated in audio mode while discarding
the audio bytes:

```powershell
npm run smoke:interview-realtime-models -- --profile=spoken_transcript
```

The lighter-mode optimization suite compares the current production-composed
prompt, a compact mode-only prompt, and the compact prompt with explicit
current-turn control. It runs First Impression, Coaching, and Rapid Fire three
times each against GPT-Realtime-2.1 Mini:

```powershell
npm run smoke:interview-realtime-mini-lighter
```

Run the strict controller candidate—which uses exact one-sentence templates for
deterministic openings, retries, and pauses while leaving answer-specific
coaching adaptive—with:

```powershell
npm run smoke:interview-realtime-mini-state-v2
```

Optional arguments include
`--models=gpt-realtime-2.1,gpt-realtime-2.1-mini,gpt-5.4,gpt-5.4-mini`,
`--scenarios=lighter|all|first_impression_v1,coaching_v1,rapid_fire_v1,mock_behavioral_v1`,
`--variants=production_v1,mini_compact_v1,mini_compact_state_v1,mini_compact_state_v2`, and
`--repetitions=1..10`. The JSON report includes aggregate run/turn pass rates,
failure reasons, latency, and cost for each scenario/model/prompt-variant group.
The CSV preserves each scripted input, current-turn objective, model response,
and rubric result for human review. Text-only output is the primary inexpensive
content benchmark. The spoken-transcript profile is the higher-fidelity wording
check and incurs audio-output usage.

## Native Chained Coaching Comparison

### Silent Coaching inspector and recovery (2026-09-02)

The default local Interview test bed is `/interview/mobile-preview`. It opens
directly to **Test Coaching · no audio**, with mirrored iPhone/Pixel frames in
Fit view. Fresh loads select Simulation; nothing starts automatically. Reset
preview returns to this framed test view and Fit sizing. Static design screens
and the other inspector tabs remain available by explicit selection.

Start with Simulation, create a test, generate the opening, type an
answer, and use Try again / More feedback / Ask Que / Move on. Saved tests reopen
after reload; CSV exports turn comparisons and JSON exports the full supplied
context, prompt versions, original/normalized/delivered responses, validation,
and usage. Exports may contain candidate information: keep them local.

Mobile-facing previews use the shared iPhone and Pixel frames as standard.
The typed Coaching controls, conversation, choices, retry, End, and saved-test
selector all run inside the phones. Both frames share one controller: typing or
submitting on either updates the other without duplicate requests. Conversation
scrolling stays inside each phone; selecting a turn updates the separate backend
inspection panel. Developer context, failure injection, prompts, and exports stay
outside the frames. Fit and Actual size apply to both phones; narrow browser
windows can scroll the device strip horizontally. This is a typed web preview,
not evidence of native keyboard, microphone, or speaker behavior.

Simulation uses the actual prompt composition, normalization, and validation
code with a deterministic response fixture. It makes no provider calls and is
not evidence of model quality. Live text requires an explicit checkbox and
submit action; it calls the same GPT-5.4 Mini decision function as native
Coaching but never transcription or TTS. Reported latency/cost is text-only.
No active prompt versions are changed by this inspector.

The endpoint is local/non-production admin-only and owner-scoped. Test records
live in `interview_coaching_inspections`, with `interview_coaching_operations`
storing text-only turn results and immutable request fingerprints. They are
not learner sessions and do not award XP, affect History, or update memory.
Simulation AI-run records have zero provider tokens and a simulation marker.
Migration: `0088_interview_coaching_inspector`.

Recovery checks:

```powershell
npm run test:interview:chained-coaching:unit
npm run test:interview:coaching:services
npm run test:mobile
npm run typecheck:mobile
npm run lint --workspace @quesiq/interview-mobile
npm run test:interview:all
```

The Coaching service test explicitly blocks network requests. It covers the
choice loop, owner/auth/input boundaries, persistence/reopening, replay and
conflict rejection, concurrent requests, failure/retry, CSV formula protection,
and isolation from learner sessions. Native component tests mock all hardware
and cover permission denial/retry, delayed permission, late responses after
End, rerenders, duplicate transcripts, choices, backgrounding, and connection
loss. Headless Playwright covers the typed inspector at desktop/mobile sizes.

Completed mobile turn text is reused after response retries; generated speech
is not retained in Postgres. A TTS failure can retry synthesis without another
coaching-model call. Device playback failures retry the cached response without
a server call. Uncertain generation failures are **not** automatically re-billed:
end/save and start a new session. A processing turn older than two minutes is
reported as uncertain; this is not a promise that provider billing was cancelled.

Final artifacts are immutable: identical retries preserve evaluation state,
different finalized artifacts are rejected. Review generation has a database
processing guard. A server crash leaving a review processing requires local
inspection before resetting it; the client must not silently launch a second
evaluation. Actual native audio routing/quality and first-audio timing remain
manual gates. No desktop/emulator automation is needed for these checks.

The native mobile Coaching mode uses a transcription-only WebRTC session for
live English transcript deltas, sends committed text to GPT-5.4 Mini, validates
the structured coaching turn, and generates the approved speech with
GPT-4o Mini TTS. Candidate audio is not retained. Generated Que speech is kept
only in the mobile cache while it plays.

Run its deterministic validation tests with:

```powershell
npm run test:interview:chained-coaching:unit
```

With the local server and database running, compare the exact chained server
path against GPT-Realtime-2.1 Mini using the same Coaching scenario:

```powershell
npm run smoke:interview-chained-coaching
```

The ignored JSON and Markdown reports under
`artifacts/interview-chained-coaching/` include behavioral rubric results,
first-audio latency, validation corrections, cost projections, and generated
chained TTS samples. Transcription quality, saved-transcript accuracy, and voice
naturalness remain native operator checks; the text-controlled comparison does
not claim those microphone-dependent results.

## Live AI Smoke

Run only when an accepted local key is intentionally configured:

```powershell
npm run test:interview:live-ai
```

Accepted keys are `OPENAI_INTERVIEW_TEST_TUNNEL_API_KEY`,
`OPENAI_INTERVIEW_API_KEY`, or `OPENAI_API_KEY`. The smoke uses disposable
local rows and the existing turn-based Interview backend. It does not deploy or
write to Render.

## Artifacts

Generated outputs are ignored by git and live under:

```text
artifacts/interview-regression/
```

Key outputs include `seed-state.json`, `service-summary.json`, `run-report.md`,
Playwright results, screenshots, traces, videos, and the HTML report.

## Troubleshooting

If the browser server returns unexpected 404s or module-resolution errors:

1. Stop any stale local test server on port 3210.
2. Confirm `npm ls pg @aws-sdk/client-s3 --depth=0` succeeds.
3. Rebuild dependencies with `npm ci` if the install is invalid.
4. Move the ignored `.next-interview-e2e` cache aside and rerun.
5. Confirm `next-env.d.ts` and `tsconfig.json` did not retain generated paths.

If service checks fail:

```powershell
npm run db:local:up
npm run db:local:migrate
npm run test:interview:services
```

If Playwright Chromium is missing:

```powershell
npm run playwright:install
```

## Manual QA Boundary

### Phase 2 local Coaching candidate

The approved implementation plan and `INTERVIEW_EXECUTION_STATUS.md` govern
promotion. In the existing framed silent inspector, open Test setup & context
and explicitly choose Candidate v2 for a new test. Current + Simulation remains
the fresh-load default. The candidate is not enabled in native learner sessions.

Run `npm run test:interview:coaching:candidate` for no-paid-call contract, fixture
and isolated service coverage. The canonical full gate includes this command.
Separate raw schema validity, structural/evidence validity, rejection, and human
quality; semantic quality remains unreviewed. Rejected responses appear in the
same inspector and exports, with no automatic regeneration. See
`INTERVIEW_PHASE2_COACHING_CANDIDATE.md` for the unapproved paid screening protocol.

### Operator-only evidence

P4.1 layout regression: `npm run test:interview:e2e --
tests/interview/mobile-layout.spec.ts --workers=2` uses the existing dedicated
Interview runner. It checks mirrored sample setup/profile/captions, read-only
behavior, evidence ordering/linking and393/412-width phone overflow/touch sizes.
The spec is also in the full suite. For lower local load use
`npm run test:interview:all -- -- --workers=2`; the separators forward the
worker limit without skipping any test.

Screenshots cover Home, Practice, Live, Review and Me; the test changes only
the isolated headless host viewport, never the user's desktop/browser. Native
component tests and local Android compile/export are separate evidence. See
`INTERVIEW_PHASE4_NATIVE_EXPERIENCE.md` and the execution ledger for acceptance.

P4.2 native Coaching waits for a cleared audio buffer before listening. Speak,
pause freely, and tap **Done answering** to commit this answer. The microphone
stops while the client waits for a matching acknowledgement and final transcript.
**End & save** still ends the session. A failed/empty/timed-out finalization
offers **Retry transcription**, reconnecting at the same question; re-speak that
answer. Partial text is never submitted as a successful answer. Keep the native
client and local backend on this same slice because the transcription route now
uses manual commits. Old clients that rely on automatic VAD submission are not
compatible with that route change.

Deterministic P4.2 cases live in
`apps/mobile/src/components/interview/chained-coaching-session.test.tsx`;
`npm run test:mobile` includes them. The existing execution-service suite checks
manual transcription configuration. The mobile-layout browser suite checks
mirrored Done/finalizing/End controls without microphone/provider activity.
Physical-phone checks must still verify that final audio at the Done boundary
is captured, natural pauses do not truncate speech, and interruptions stop
recording. Mocked events cannot certify WebRTC audio/data-channel timing.

P4.3 adds a native Coaching **Type instead** fallback during connection,
microphone preparation/listening, or transcription failure. It closes the
microphone transport and keeps this session in typed mode. Uncommitted speech
is discarded, not submitted. Type the answer/question and explicitly send it;
the current response remains readable with historical captions collapsed.
**Mute microphone** pauses capture without committing buffered speech, and
**Done answering** still controls voice submission. **Read response**
after playback failure uses the already validated result. This client fallback
does not remove server TTS generation or prove a runtime cost saving.

The same native component suite covers typed/microphone boundary cases.
`mobile-layout.spec.ts` covers mirrored typed input, mute/phase labels, choices,
contained scrolling and End reachability. The design workbench's **Simulated
session state** selector is outside the phone UI and changes only labelled
samples; it is not a provider request or native event simulator. Keep initial
Test Coaching/no audio, Fit and Simulation defaults. Native keyboard, real
interruption and audio behavior still require the separate operator gate.

Automation does not validate real microphone permission prompts, microphone
selection, headset behavior, audio clipping, speaker quality, or genuine
Realtime conversation quality. Verify those manually in the visible local app
at `http://127.0.0.1:3100` after the automated gate is green.


## P4.4 stage telemetry and latency reports

The native Coaching artifact includes optional bounded `coachingTelemetry`.
`npm run test:mobile` covers its contracts, percentile math, persistence and
native event sequences. `test:interview:all` exercises mocked server stages,
provider/application request IDs, failure/replay and guarded inspection export.
These tests make no provider calls and do not measure real audio latency.

An admin can export the recent100 inspection records through
`/api/admin/interview/inspection-runs/export?format=json`. The default CSV is
unchanged. A finalized artifact or pending `{ artifact: ... }` file also works.
Exports may contain learner text; keep files in ignored local artifacts.
The report itself contains diagnostic metadata only.

Create a separate profile for each device, OS, app build and network condition:

```json
{"evidence":"mocked","device":"fixture","os":"fixture","build":"test","network":"mock"}
```

Then run from the repository root (REPORT must not already exist):

```powershell
npx tsx scripts/interview/report-coaching-latency.ts INPUT.json PROFILE.json REPORT.json
```

For separately authorized device work, use `device_observed` and record the
actual profile. Collect comparable ordinary voice answers; preserve failed and
recovered attempts. Do not mix profiles or label synthetic data as device data.
Nearest-rank P50/P95 use fresh, unrecovered voice answers with complete ordered
client stages and the same model/voice configuration. Counts include excluded
outcomes and recovery attempts. Check sample count, missing telemetry and
truncation before comparing reports; no fixed performance target is implied.

Answer end means Done, and first audio means the first player status with
`playing=true` and `currentTime>0`, not acoustic verification. Completed playback
without that event is `audio_unobserved`; missing timing is never zero latency.
Server stages use a separate clock and cannot be subtracted from client stages.
Telemetry is capped at200 observations per artifact; dropped entries are counted.
No baseline is available from empty/legacy/ineligible records. Crash-before-save
persistence remains P4.6; real microphone/speaker checks remain operator work.

P4.6 now adds committed Coaching checkpoints and restart recovery; see the
recovery contract below. The earlier P4.4 evidence itself did not test durability.

## P4.5 progressive audio spike

See [the bounded spike contract](INTERVIEW_P45_STREAMING_SPIKE.md) for the
development route, loopback fixture commands, cache policy and operator gates.
Normal Coaching retains full-file playback. The spoken choice menu is shortened
without changing visible choices or full feedback/questions.

The execution-unit gate includes the real loopback fixture transport tests:
progressive first chunk, identical full bytes, byte ranges, cancelled/truncated
streams and intact fallback. The execution-services gate verifies the actual
mocked TTS request uses the concise cue. The native suite checks validation
before play, timeout/release, stale responses/downloads, explicit file fallback
and stop during audio preparation. These tests never play sound.

The development route is disabled without both __DEV__ and its explicit origin.
No env setting is added automatically. Default WAV tone is transport test data;
approved MP3, progressive audible playback and interruption behavior on target
devices remain separately authorized operator checks. Spike firstAudioMs is not
a Done-to-audio baseline and must not enter the P4.4 report.

## P4.6 checkpoints and pending-save recovery

See [the recovery contract](INTERVIEW_P46_RECOVERY_CONTRACT.md). The mobile gate
tests new-generation file writes/read-back/move, old-copy retention on failure,
corrupt-record fallback, account isolation/legacy ownership verification,
lost server acknowledgement, conflicting saved transcripts, single-flight saves,
empty-session handling and confirmed-review boundaries. Native component tests
cover loss/interruption, detached committed checkpoints and no writes after End.

No special provider environment or paid test is required. File operations are
mocked in Jest; actual process-kill/disk-full/reopen and audio interruption on a
physical phone remain manual gates. Preserve failed logs alongside passing reruns.
No checkpoint contains partial speech/raw audio. Recovery notices are scoped to
the signed-in account, skip active sessions and retain work on failure.

## Phase7 local beta gates (2026-09-10)

`npm run test:interview:beta` runs accounting/report tests and local DB safety
services; it is included in `test:interview:all`. Synthetic mocks cannot call paid
providers. Final accepted evidence is in artifacts/implementation-2026-09-10:
p7-interview-accepted.log, p7-mobile-accepted.log, p7-mobile-typecheck-accepted.log,
p7-mobile-lint-accepted.log, p7-android-compile.log and p7-hermes-accepted.log.
Browser phase7-limits captures cover pending save and deferred review; they are
simulations, not device proof. INTERVIEW_PHASE7_CONTRACT.md owns CLI examples and
INTERVIEW_V1_REMAINING_GATES.md owns physical/paid/operational follow-up.

## Chained voice safety follow-up

`npm run test:interview:voice-safety` is included in the full Interview service gate.
Use artifacts/voice-safety-2026-09-10 for final evidence: static-final.log,
voice-services-final.log, mobile-final.log, mobile-typecheck-final.log,
mobile-lint-final.log, android-compile.log and hermes-final.log. Full services also
pass in interview-final.log. Browser acceptance is browser-serial.log,46/46 via
`npm run test:interview:e2e -- --workers=1`; initial default-worker transport resets
are retained and the standard harness/assertions remain unchanged. Do not run
concurrent source edits/builds during browser acceptance. Phone captures prove only
simulated limit/save states. See INTERVIEW_CHAINED_VOICE_SAFETY.md for live gaps.
