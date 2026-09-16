# QuesIQ-dev restart pointer

Last verified: 2026-09-12. Timezone: America/New_York.
Scope: local Git checkpoint, deterministic application/native checks and build preparation. No device, paid-provider or deployment verification.

## Dedicated backend hosting (2026-09-15)

User authorized setup of the new QuesIQ Supabase database and backend connection. Project analiejpwazwbeabpayp in A2RKS is Healthy in North Virginia; Data API is verified disabled. All97 canonical migrations replayed successfully in a new local database, second pass is a no-op, and local backup/restore and production build pass. No local test/user data was copied to Supabase. Hosted setup now passes: 97 migrations, 132 public tables, zero users/sessions/AI runs, and zero anon/authenticated table grants, independently verified over certificate-validated TLS. The password stays in ignored .env.supabase.local. User authorized a new dedicated Render service on September 15. quesiq-interview-api (srv-dakhv5tg1s2s73cd1ne0) is live at ec33081 from codex/interview-mobile; ten HTTPS checks pass including database-backed login rejection and route isolation; automatic deployment is off and the old services remain suspended. A dedicated database runtime role and fresh service secrets are configured. See docs/rebuild/INTERVIEW_HOSTING_2026-09-15.md for current hosted verification and remaining onboarding gates. See [setup record](docs/rebuild/QUESIQ_SUPABASE_SETUP_2026-09-12.md) before continuing. This scoped authorization supersedes older local-only language for the new database setup, not paid AI, other products or device work.

## Account onboarding (2026-09-16)

Native signup/recovery and Interview-only verification/reset pages are implemented and locally verified. New routes stay disabled without configured email delivery. User input is pending on email service and verified sender; no real email was sent. See docs/rebuild/INTERVIEW_ONBOARDING_2026-09-16.md for tests and activation boundaries.

## Current phase

Interview mobile v1 remains the exclusive active lane. Phase4-6, P7.1-P7.4 and the chained voice safety follow-up are accepted locally. P6.6 remains excluded. The user authorized a local checkpoint and work that does not require a physical device; the bounded accessibility/input follow-up is implemented and its tests pass.

## Verified state

- Branch codex/interview-mobile. Commit ec0118c records the previously accepted baseline (226 files). Accessibility fixes and this refreshed handoff form the follow-up checkpoint; use git log/status for its final hash and working-tree state.
- Fresh full Interview gate passes: readiness41/2manual warnings, root typecheck/lint, unit/services and46/46 browser cases using --workers=1.
- Fresh mobile gate passes:171 native tests/25 suites,15 contracts and mobile API/auth/history checks. Mobile typecheck passes; lint0 errors/57 warnings.
- Hermes Android export and Android debug compilation pass (549 tasks,55 executed,4m55s). No installation or device operation.
- Sign-in supports keyboard-aware scrolling, persistent field labels and error alerts. Save/recovery controls are in scroll content; microphone accessibility reports on/off/paused; Practice exposes mode-description hints.
- Evidence: artifacts/local-readiness-2026-09-12. Detailed scope and limitations: docs/rebuild/INTERVIEW_LOCAL_ACCESSIBILITY_REVIEW_2026-09-12.md. Earlier acceptance logs remain historical evidence.
- Existing local migrations0094-0097 and voice safeguards remain unchanged. No new database migration or runtime/provider setting was introduced. No real economics baseline or device proof exists.

## Immediate priorities

1. Preserve the local commits. No push or production integration occurred.
2. Consult docs/rebuild/INTERVIEW_V1_REMAINING_GATES.md for the next separately scoped package. Local accessibility property/scroll coverage is complete for the reviewed defects; physical screen-reader, larger-text and keyboard checks remain open.
3. A local privacy/retention/account-deletion inventory is a useful independent next review; no account deletion or external activation is authorized by this suggestion.

## Blockers and boundaries

Provider support remains deferred by user decision; do not follow it up or wait for it before independent local work. Real-provider activation stays blocked pending cost bounds, endpoint termination and independent host-failure proof. Current models, explicit Done and full-file playback remain unchanged.

Paid AI quality/cost, physical Android/iPhone audio/durability/input/picker behavior, signing, hosted reachability/auth, privacy/deletion, store distribution and release operations remain open. Browser previews and mocked native tests do not close those gates. Default preview remains Test Coaching / no audio, Fit, Simulation. Stay in QuesIQ-dev; no Study/DPE/NCLEX/Quira or QuesIQ-live changes.

## Restart prompt

Read AGENTS.md, this pointer and docs/rebuild/INTERVIEW_EXECUTION_STATUS.md. Verify Git state before edits. Do not repeat completed Phase4-7 or accessibility fixes. The execution ledger and remaining-gates register control evidence and follow-up. Support is deferred; paid/provider/device/deployment work is not authorized by this handoff.
