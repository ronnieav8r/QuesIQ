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

## Resume at P4.2

Implement bounded transcript accumulation and explicit Done-answering
finalization in the existing Coaching path. Test acknowledgement/late-event
ordering without paid calls or real audio. Do not promote candidate prompts,
enable another engine, or claim latency/device proof from P4.1.

## Documentation checked before native edits

- [Expo SDK57 reference](https://docs.expo.dev/versions/v57.0.0/)
- [SDK57 safe-area-context](https://docs.expo.dev/versions/v57.0.0/sdk/safe-area-context/)
- [React Native KeyboardAvoidingView](https://reactnative.dev/docs/keyboardavoidingview)
- [React Native ScrollView](https://reactnative.dev/docs/scrollview)

Use the installed SDK57/RN0.86 types as the implementation constraint. No SDK
upgrade or dependency installation is implied by consulting documentation.
