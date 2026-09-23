# QuesIQ-dev restart pointer

Last verified: 2026-09-23T06:12:00-04:00
Timezone: America/New_York.
Scope: Git/status documentation, Render metadata/HTTP checks and read-only Brevo API access. Application tests were not rerun today; dated evidence below remains the baseline.

## Current phase

Interview mobile v1 only. Native signup, verification and password recovery are implemented; complete email configuration and a bounded end-to-end account test next. Email activation is blocked by Brevo IP authorization and a missing approved test recipient. No new feature slice is pending in this handoff.

## Verified state

- Native/server onboarding implementation:94346d6; prior documentation checkpoint:edd13f9. September16 evidence:176 native tests/26 suites, mobile typecheck, zero lint errors, production build, mocked-email/local-DB service tests and phone-width browser form checks pass. See [onboarding record](docs/rebuild/INTERVIEW_ONBOARDING_2026-09-16.md).
- Render quesiq-interview-api, srv-dakhv5tg1s2s73cd1ne0, Virginia Starter. Live source94346d6 confirmed September23; latest deploy dep-dap313e7bikc73ep7fu0 was initiated by Render September22. Automatic deployment remains off. API: https://quesiq-interview-api.onrender.com. Fresh health200 and Study404; September16 eight-check onboarding/route evidence remains documented.
- Supabase analiejpwazwbeabpayp: September12 verification applied97 migrations/132 public tables with no imported learner data. Runtime role has public data access but no schema administration; TLS verification uses config/supabase-ca.crt. [Database record](docs/rebuild/QUESIQ_SUPABASE_SETUP_2026-09-12.md), [hosting record](docs/rebuild/INTERVIEW_HOSTING_2026-09-15.md).
- User confirmed login@quesiq.com and quira@quesiq.com verified, quesiq.com authenticated. Chosen sender:login@quesiq.com, name QuesIQ Interview. Key saved in ignored .env.brevo.local. Brevo API verification returned401 with an explicit unrecognised-IP error; key usability and sender status have not yet been API-verified. Safe diagnostic in ignored .codex-local/brevo-access-check.json.
- No Brevo key uploaded to Render, no onboarding activation, no emails sent and no real account lifecycle test. Local test database remains separate.

## Current working state

Git root is this QuesIQ-dev folder; branch codex/interview-mobile in existing ronnieav8r/QuesIQ repository. Handoff documentation changes are being checkpointed; inspect git status/log for the final commit. Documentation pushes do not change the running service while auto-deploy is off. Umbrella workspace is not a working Git repository.

## Immediate priorities

1. Resolve Brevo authorized-IP restrictions for the intended validation computer and Render outbound addresses; use the onboarding record. Do not disable IP protection globally. Preserve the saved key; do not infer it needs replacement from this error.
2. Verify the selected sender through the API, then merge only Brevo/sender/origin settings into Render. Preserve DATABASE_URL, AUTH_SECRET and MOBILE_AUTH_SECRET. Keep delivery disabled until ready for the test.
3. Obtain one user-approved recipient and perform a bounded real verification/login/reset test. Record actual inbox delivery and account behavior, not merely provider acceptance. Never run local seeded suites against hosted Supabase.
4. After account readiness, use [remaining gates](docs/rebuild/INTERVIEW_V1_REMAINING_GATES.md) for the next package: hosted native-build origin, signing/devices, privacy/deletion and release operations.

## Blockers and open decisions

Paid AI/provider activation, physical devices, signed iPhone/Android distribution and store release remain unverified. Apple enrollment was pending at the prior checkpoint; recheck rather than assume it changed. Provider support remains deferred, safety guards stay closed and P6.6 excluded. Stay Interview-only in this repo, with Test Coaching / no audio as the local preview default. Do not touch QuesIQ-live or other product lanes. Secrets remain in ignored environment files; never print or commit them.

Reset tokens are atomic/single-use; reset revokes refresh tokens but existing access tokens can survive their remaining15-minute lifetime. Per-address cooldown persists; IP/global throttles are process-local and need launch review.

## Next verification

Read-only Brevo account/sender requests with the saved key after IP authorization; report sanitized status only. Later use the exact bounded live test above. Local regression for code changes: npm run test:mobile:onboarding (loopback/mock email only), npm run test:mobile and npm run build as appropriate. Prior September12 Android compilation/Hermes evidence does not certify later native changes or physical operation.

## Restart prompt

Open E:\Codex\QuesIQ, read its AGENTS.md/PROJECT_STATE.md, then this worktree's AGENTS.md, this file, docs/rebuild/INTERVIEW_EXECUTION_STATUS.md and docs/rebuild/INTERVIEW_ONBOARDING_2026-09-16.md. Verify Git, Render deployment and the current Brevo IP error. Resume email setup from the saved ignored key; request the missing test recipient before sending anything. Do not rebuild completed features or activate AI.
