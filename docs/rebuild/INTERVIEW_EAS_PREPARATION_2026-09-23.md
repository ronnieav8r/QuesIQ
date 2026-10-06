# Interview EAS iPhone preparation — 2026-09-23

Current result (2026-10-06): signed development build 0.1.0 (2) succeeded. See [current build record](INTERVIEW_IPHONE_BUILD_2026-10-06.md). The dated setup notes below describe earlier checkpoints.

Project: https://expo.dev/accounts/a2rks-llc/projects/quesiq-interview
Project ID: 2b7b5307-d69e-4188-9392-c1e67d7d7b0d
Bundle ID: com.quesiq.interview

## Completed

- Project created and linked under user-authorized a2rks-llc.
- Internal physical-device development profile in apps/mobile/eas.json; hosted API origin and dev auto-sign-in disabled. This development client needs Metro for iterative JavaScript development; it is not a standalone TestFlight beta.
- SDK 57 patch versions aligned with Expo recommendations; lockfile updated. Expo install added expo-image and expo-web-browser config plugins.
- Root .easignore preserves Git exclusions and excludes generated native folders, build output and signing files. Initial archive included generated Android output; corrected archive has 844 files. Required app/workspace manifests and lockfile match current files. No forbidden filenames or matches from the bounded private-key/OpenAI/GitHub-token pattern scan. This is not a guarantee against every possible secret format.
- Expo Doctor 21/21, mobile TypeScript, native Jest 26 suites /176 tests, and iOS Hermes export passed.
- npm reports 19 audit findings (1 low, 15 moderate, 3 high); no forced dependency remediation performed.

## Remaining

- EAS credentials view: no credentials configured for this project. Device listing: no Apple teams found for a2rks-llc. Apple enrollment remains active per user, independently of this EAS linkage.
- Apple login must be performed privately by the user. From apps/mobile run: npx --yes eas-cli@latest credentials --platform ios. Choose development and log in when prompted. Never put Apple passwords or recovery codes in chat.
- After account/team linkage: configure distribution certificate and provisioning profile, register the intended iPhone, verify EAS build allowance/cost, then create the first cloud build with user authorization as needed.
- Native iOS prebuild was attempted only in an ignored archive copy; Expo refuses iOS generation on Windows and requires macOS/Linux. No CocoaPods or Xcode compilation verified.
- No build queued, Apple credentials changed, device operated, store submission, backend deployment, paid AI or email sent.

Evidence stays ignored: .codex-local/eas-archive-check-20260923.json, eas-archive-20260923-clean/, ios-export-20260923/.

## Apple account follow-up

2026-09-23 Apple signing follow-up: restored user Apple session and verified A2RKS, LLC team2FKFMHK49J. Registered com.quesiq.interview and created an Apple Distribution Certificate through EAS. No devices were registered; generated an Expo website device-registration link and waiting for user to complete it on their iPhone. Provisioning profile and cloud build remain pending. No passwords, session cookies or private keys copied into docs.

## First build

2026-09-23 signed build queued: iPhone registration verified; active ad hoc profile8QRABY9YZB covers the registered iPhone. EAS confirmed credentials ready. a2rks-llc Free plan had0/15 iOS builds used and no overage before submission. Submitted first internal development build b36d4f0b-4f5e-4f33-971a-790f56538ddc (version0.1.0/build1), using remote frozen credentials. Build uses uploaded working-tree changes; reported Git HEAD992e788 is not a complete source snapshot. No store submission or installation. Build result pending.

Build: https://expo.dev/accounts/a2rks-llc/projects/quesiq-interview/builds/b36d4f0b-4f5e-4f33-971a-790f56538ddc

CLI noted missing ITSAppUsesNonExemptEncryption declaration; resolve export-compliance declaration before any App Store/TestFlight submission. This build uses internal ad hoc distribution.
