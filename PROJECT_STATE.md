# QuesIQ-dev restart pointer

Last verified: 2026-10-06. Scope: signed iPhone development build 0.1.0 (2) and hosted owner Coaching pilot; physical iPhone retest remains open.

## Current phase

- 2026-10-06 signed iPhone build 0.1.0 (2) succeeded: [Expo build 7007ded7](https://expo.dev/accounts/a2rks-llc/projects/quesiq-interview/builds/7007ded7-0a24-4dd1-b442-a819385f03bd), source `a8f85cc`, registered iPhone provisioned. IPA inspection confirmed bundle ID, version/build, microphone declaration and signing profile. This development client needs Metro through the desktop launcher; install and physical Coaching audio retest remain open. See [build record](docs/rebuild/INTERVIEW_IPHONE_BUILD_2026-10-06.md).

- 2026-09-27 owner Coaching pilot activated: user approved reuse of the existing OpenAI key and $20 total application allowance, accepting that it is not a provider invoice cap. Dedicated Interview Render deploy dep-dasnhlg473hc7394d80g is live at a613939; only the configured owner account and Coaching mode are enabled. Five-minute sessions, $5 session allowance, lifetime $20 admission accounting and supervised transcription shutdown apply. Build, focused lint, beta/voice-safety/pilot and execution tests passed. Hosted headless test verified WebRTC connect, generated speech, completed transcription and confirmed provider shutdown. Audio holds $1.35 and recorded text usage $0.002274 remain in the test ledger; unused review allowance released. Physical iPhone mic/option-5 retest remains open. See [pilot evidence](docs/rebuild/INTERVIEW_COACHING_PILOT_2026-09-27.md). This supersedes older statements that all paid AI is disabled; public activation and other modes remain blocked.

- 2026-09-23 iPhone coaching cleanup fix: user-provided native trace points to chained-coaching-session.tsx unmount pause(). Expo useAudioPlayer releases its shared object before our later passive cleanup; removed the redundant unmount pause while retaining active-session stop/pause and transport/file cleanup. Regression mock now models hook release order and rejects use after release. New test reproduced the failure before the fix; full native suite177/177 and mobile TypeScript pass afterward. Device retest remains open. This does not prove why the component unmounted; existing non-active AppState safety handling may end a session during a permission dialog and remains a separate first-permission behavior to verify. No provider activation, backend deploy or new native build. Home-screen onboarding remains discussion-only.

- 2026-09-23 signed build queued: iPhone registration verified; active ad hoc profile8QRABY9YZB covers the registered iPhone. EAS confirmed credentials ready. a2rks-llc Free plan had0/15 iOS builds used and no overage before submission. Submitted first internal development build b36d4f0b-4f5e-4f33-971a-790f56538ddc (version0.1.0/build1), using remote frozen credentials. Build uses uploaded working-tree changes; reported Git HEAD992e788 is not a complete source snapshot. No store submission or installation. Build result pending.

- 2026-09-23 Apple signing follow-up: restored user Apple session and verified A2RKS, LLC team2FKFMHK49J. Registered com.quesiq.interview and created an Apple Distribution Certificate through EAS. No devices were registered; generated an Expo website device-registration link and waiting for user to complete it on their iPhone. Provisioning profile and cloud build remain pending. No passwords, session cookies or private keys copied into docs.

- 2026-09-23 iPhone preparation follow-up: SDK57 patches aligned; Expo Doctor21/21, TypeScript, native176 tests and iOS Hermes export pass. Corrected EAS archive has844 files with local env/signing/generated-native files excluded. EAS has no Apple team or project signing credentials; user Apple login is next. Windows blocked native iOS prebuild. No cloud build or credential changes. Details: docs/rebuild/INTERVIEW_EAS_PREPARATION_2026-09-23.md.

- 2026-09-23 Expo setup: created and linked @a2rks-llc/quesiq-interview (project ID 2b7b5307-d69e-4188-9392-c1e67d7d7b0d). apps/mobile/eas.json defines an internal physical-iPhone development-client profile using the hosted Interview API and EXPO_PUBLIC_DEV_AUTO_SIGN_IN=false. No cloud build, signing/provisioning change, device installation or store submission. Next: inspect build archive and confirm Apple signing/device registration before the first cloud build. EAS resolved the iOS development profile successfully; hosted /health returned HTTP 200. Run EAS commands from apps/mobile.

Interview mobile v1 only. Resend and the restricted owner Coaching pilot are live. Gmail reset and Hotmail verification both have provider delivery confirmation and user link testing, while earlier automated account-state checks remain unresolved. Next focus is installing build 2 and retesting Coaching on the registered iPhone. The detailed acceptance record is docs/rebuild/INTERVIEW_EXECUTION_STATUS.md; email work is in docs/rebuild/INTERVIEW_ONBOARDING_2026-09-16.md.

## Current working state

QuesIQ-dev is on codex/interview-mobile at `a8f85cc`; mobile build source and restricted Coaching backend are committed/pushed. The dedicated Render service remains live at `a613939` with auto-deploy off.

- Resend replaces Brevo in the shared account-email adapter and Interview configuration gate. Local tests, lint and production build pass. No schema/dependency changes.
- Hosted quesiq-interview-api retains Resend onboarding and runs the owner Coaching pilot at `a613939` (deploy `dep-dasnhlg473hc7394d80g`). Health200 and blocked Study/dev-session404 passed. Auto-deploy remains off; environment updates can trigger deployment.
- Brevo local access, active sender and domain authentication were verified. User authorized Render ranges74.220.49.0/24 and74.220.57.0/24. Gmail receipt/verification and hosted login previously passed; the user now confirms testing the Gmail reset link. Independent final reset/account-state verification remains open. Three Hotmail attempts still lacked delivery/bounce evidence at the last check.
- User approved bounded Gmail and Hotmail account tests. Exact recipients and evidence are in the onboarding record. Test credentials/tokens remain only in ignored .codex-local files. Never print them.
- Resend key is saved in ignored .env.resend.local and merged into Render. quesiq.com is API-confirmed verified. One Hotmail verification and one Gmail reset sent through hosted app; Resend reports both delivered. Brevo key is unused but not revoked.

## Next steps

1. Install signed build 0.1.0 (2) on the registered iPhone from the Expo build page. Start the desktop launcher (option 5 for hotel/travel), then retest Coaching microphone, playback and connection cleanup. Record actual device behavior before accepting the physical gate.
2. Reconcile final account state without repeating email-delivery setup: both links were user-tested, but prior automated checks saw Gmail old-password200/refresh200 and Hotmail login401. Do not request passwords in chat or resend emails automatically.
3. Continue through docs/rebuild/INTERVIEW_V1_REMAINING_GATES.md. Only the configured owner account and Coaching mode have paid AI admission; broader voice, release and provider billing gates remain open.

## Restart prompt

Read this pointer, AGENTS.md and the execution ledger. Resume Interview-only physical testing from signed build 0.1.0 (2) and the launcher. Resend and the owner Coaching pilot are live; preserve the documented account-state discrepancy. Keep secrets private and do not broaden the paid pilot.

## Boundaries

No QuesIQ-live/other-lane changes, mailbox routing changes, or store release. Keep Test Coaching / no audio as the local preview default. Existing access tokens may survive a password reset for their remaining15-minute lifetime; refresh tokens are revoked. Loopback test suites must never target hosted Supabase.
