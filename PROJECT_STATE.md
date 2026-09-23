# QuesIQ-dev restart pointer

Last verified: 2026-09-23. Scope: Resend deployment, hosted route checks and provider delivery events; local mocked onboarding tests/lint/build passed before deployment.

## Current phase

Interview mobile v1 only. Resend is live; Gmail reset and Hotmail verification both have provider delivery confirmation. Inbox receipt and link completion await user confirmation. The detailed acceptance record is docs/rebuild/INTERVIEW_EXECUTION_STATUS.md; email work is in docs/rebuild/INTERVIEW_ONBOARDING_2026-09-16.md.

## Current working state

QuesIQ-dev is on codex/interview-mobile at9efc8cc; implementation is committed/pushed. Onboarding/handoff documentation is being checkpointed separately.

- Resend replaces Brevo in the shared account-email adapter and Interview configuration gate. Local tests, lint and production build pass. No schema/dependency changes.
- Hosted quesiq-interview-api uses Resend at9efc8cc with onboarding enabled. Confirmed live deploy: dep-dapuj2rncjis73fp7rog. Health200 and blocked Study/dev-session404 pass. Auto-deploy remains off; environment updates can trigger deployment.
- Brevo local access, active sender and domain authentication were verified. User authorized Render ranges74.220.49.0/24 and74.220.57.0/24. Gmail receipt/verification and hosted login passed; Gmail reset completion is unconfirmed. Three Hotmail attempts still lacked delivery/bounce evidence at the last check.
- User approved bounded Gmail and Hotmail account tests. Exact recipients and evidence are in the onboarding record. Test credentials/tokens remain only in ignored .codex-local files. Never print them.
- Resend key is saved in ignored .env.resend.local and merged into Render. quesiq.com is API-confirmed verified. One Hotmail verification and one Gmail reset sent through hosted app; Resend reports both delivered. Brevo key is unused but not revoked.

## Next steps

1. Obtain user confirmation of the newest Hotmail verification email and Gmail reset email, then complete the links. Never request the new password in chat.
2. Verify Hotmail login and Gmail old-password/refresh rejection after reset. New-password login requires user-side entry; do not claim it from a successful reset alone.
3. Preserve provider delivery evidence separately from inbox/user-operation confirmation. No automatic resends.
4. Use docs/rebuild/INTERVIEW_V1_REMAINING_GATES.md after onboarding; provider AI, devices, signing, privacy/deletion and release gates remain open.

## Boundaries

No QuesIQ-live/other-lane changes, mailbox routing changes, paid AI activation, physical devices or store release. Keep Test Coaching / no audio as the local preview default. Existing access tokens may survive a password reset for their remaining15-minute lifetime; refresh tokens are revoked. Loopback test suites must never target hosted Supabase.
