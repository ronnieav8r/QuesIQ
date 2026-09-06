# QuesIQ Interview mobile

Expo SDK 57 development-build client for the focused iOS and Android Interview experience. It shares the existing Next.js/Postgres backend and stores no OpenAI credential or raw session audio on the device.

## Local prerequisites

- Node 24 and npm 11
- Docker Desktop for local Postgres
- Android Studio, Android SDK Platform Tools, and a running Android emulator
- Java 21 for Gradle/Prefab (the QuesIQ launcher uses `%LOCALAPPDATA%\QuesIQ\jdk-21.0.12.1` when present; Java 25 currently makes Prefab warnings fail native CMake configuration)
- Existing Interview/OpenAI credentials in the repository-root ignored `.env.local`

Expo Go cannot run this app because live sessions use the native
`react-native-webrtc` module and Coaching playback uses `expo-audio`.

## Run locally

From the repository root:

```powershell
npm ci
npm run db:local:up
npm run db:local:migrate
npm run dev:local
```

In a second terminal:

```powershell
npm run mobile:android:emulator
npm run mobile:android:prepare
npm run dev:mobile:android
```

The checked local AVD name is `QuesIQ_Pixel_9_API_36`. `mobile:android:prepare` finds Android SDK Platform Tools in the standard Windows SDK location and runs `adb reverse tcp:3100 tcp:3100`, allowing the emulator to use the local server at `127.0.0.1:3100`. The first `dev:mobile:android` run creates and installs the local development build. After native dependencies or config plugins change, rebuild with this command; for JavaScript-only work use `npm run dev:mobile`.

The AVD has host audio input/output enabled. `npm run mobile:android:emulator` also starts it with `-allow-host-audio`, the command-line equivalent of **Extended controls → Microphone → Virtual microphone uses host audio input**.

Development builds use the ignored `apps/mobile/.env.local`. Keep server credentials only in the repository-root `.env.local`; never add OpenAI keys to an `EXPO_PUBLIC_` variable.

## Coaching engine

Mobile Coaching is the chained comparison slice:

```text
microphone -> gpt-live-transcribe WebRTC deltas -> GPT-5.4 Mini
-> deterministic validation -> GPT-4o Mini TTS -> user choice
```

The four choices are Try again, More feedback, Ask Que, and Move on. The
microphone is disabled while Que is thinking or speaking, captions are hidden
by default, and background/network loss finalizes a partial transcript for the
existing on-device artifact recovery flow. Other mobile modes continue using
the full Realtime voice screen.

Because `expo-audio` is native, rebuild the Android development client after
pulling this slice with `npm run dev:mobile:android` before using normal
JavaScript-only `npm run dev:mobile` cycles.

## Verify

The default local test bed is `http://127.0.0.1:3100/interview/mobile-preview`.
It opens directly to **Test Coaching · no audio** in the shared iPhone/Pixel
frames (Fit sizing, Simulation on fresh load). Reset preview returns to this
framed test view. Tests and paid calls never start automatically. Keep mobile
controls inside the frames and developer inspection outside as standard practice.
Simulation is free of provider calls; Live text is explicitly opt-in and omits
both transcription and speech generation. Inspector tests are separate from
learner sessions. See `docs/rebuild/INTERVIEW_REGRESSION.md` for recovery,
idempotency, export, and test details.

Native Coaching now separates Retry connection / response / playback. End and
backgrounding cancel pending work, stop tracks, and freeze the saved transcript.
If text is already persisted, response retries reuse it. A failed review reports
that the transcript is saved and offers Retry review instead of reuploading it.

```powershell
npm run typecheck:mobile
npm run lint --workspace @quesiq/interview-mobile
npm run test:mobile
npx expo-doctor apps/mobile
npm run test:interview:all
npm run test:interview:chained-coaching:unit
npm run smoke:interview-chained-coaching
```

The live screen displays a deterministic three-word proof phrase in development builds. Speak that phrase during the session. Clear the Android log before each run, capture it after the saved review has opened, then generate the ignored report:

```powershell
npm run mobile:android:proof-log -- --clear
# Complete the native session, force-stop/relaunch, and reopen it from History.
npm run mobile:android:proof-log
npm run test:mobile:proof -- --profile smoke --metrics <adb-logcat-path> --que-audio-heard --history-reopened
```

Use `--profile smoke` for the short First Impression run. It accepts a terminal `too_short` review. Use `--profile certification` for the Mock Interview run of at least 120 seconds; that profile requires a completed evaluation. `--session` and `--phrase` remain available as overrides, but normally both values come from the native proof log.

Both profiles check microphone permission, WebRTC peer/data-channel state, the remote audio track, inbound and outbound audio bytes, audible Que output, both transcript speakers, local Postgres persistence, the displayed phrase, and operator confirmation that the saved review reopened from History after an app restart. Reports and native logs are ignored under `artifacts/mobile-native-proof/`.

## Scope

Included: Home, four standard Practice modes, live session, History/Review, Me/Profile, dev and email/password authentication, rotating refresh tokens, and the versioned mobile Interview API.

Deferred: Stories, Debrief, Question Queue, Hands-Free Coaching, Quira, Admin, billing, offline mode, notifications, store submission, and production deployment.
