# QuesIQ Interview mobile

Expo SDK 57 development-build client for the focused iOS and Android Interview experience. It shares the existing Next.js/Postgres backend and stores no OpenAI credential or raw session audio on the device.

## Local prerequisites

- Node 24 and npm 11
- Docker Desktop for local Postgres
- Android Studio, Android SDK Platform Tools, and a running Android emulator
- Existing Interview/OpenAI credentials in the repository-root ignored `.env.local`

Expo Go cannot run this app because the live session uses the native `react-native-webrtc` module.

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
npm run mobile:android:prepare
npm run dev:mobile:android
```

`mobile:android:prepare` runs `adb reverse tcp:3100 tcp:3100`, allowing the Android emulator to use the local server at `127.0.0.1:3100`. The first `dev:mobile:android` run creates and installs the local development build.

Development builds use the ignored `apps/mobile/.env.local`. Keep server credentials only in the repository-root `.env.local`; never add OpenAI keys to an `EXPO_PUBLIC_` variable.

## Verify

```powershell
npm run typecheck:mobile
npm run lint --workspace @quesiq/interview-mobile
npm run test:mobile
npx expo-doctor apps/mobile
npm run test:interview:all
```

After a native voice run, save the Metro log and generate the ignored proof report:

```powershell
npm run test:mobile:proof -- --metrics <metro-log-path> --session <session-id> --phrase "<unique spoken phrase>" --que-audio-heard --history-reopened
```

The report checks microphone permission, WebRTC peer/data-channel state, inbound and outbound audio bytes, audible Que output, both transcript speakers, local Postgres persistence, the spoken phrase, evaluation completion for sessions at least 120 seconds long, and operator confirmation that the saved review reopened from History after an app restart.

## Scope

Included: Home, four standard Practice modes, live session, History/Review, Me/Profile, dev and email/password authentication, rotating refresh tokens, and the versioned mobile Interview API.

Deferred: Stories, Debrief, Question Queue, Hands-Free Coaching, Quira, Admin, billing, offline mode, notifications, store submission, and production deployment.
