# Interview signup and recovery

Date: 2026-09-16. Scope: native account creation/recovery and Interview-only email landing pages. Existing Auth.js identity and PostgreSQL schema retained; no migrations.

## Implemented

- Native sign-in links to account creation and password recovery. Creation collects email/password/confirmation and optional first name, clears passwords on success, supports resending verification, and never signs in before email verification.
- Public mobile API register, resend-verification and password-reset/request return a generic inbox message for eligible/unknown addresses. Duplicate signup never overwrites credentials. Request bodies are bounded to 8 KiB.
- Verification and reset links use trusted INTERVIEW_AUTH_ORIGIN, 32 random bytes, hashed database tokens and 30-minute expiration. GET renders a form without consuming a token; POST performs confirmation. Pages have no third-party assets, no-referrer/no-store headers and restrictive CSP.
- Verification tokens are separate from Auth.js by identifier namespace and are consumed atomically. Password resets serialize per credential, consume a token once, invalidate all outstanding reset links and revoke mobile refresh tokens. Existing signed access tokens can remain valid for their remaining 15-minute lifetime; immediate access-token revocation is not implemented.
- Persistent per-email 60-second cooldown spans signup/resend/reset. HTTP per-IP and global 15-minute limits are process-local and reset on restart; current single-instance deployment only. Distributed abuse protection remains a launch review item.
- New onboarding remains disabled unless INTERVIEW_ONBOARDING_ENABLED=1, BREVO_API_KEY and AUTH_EMAIL_FROM are configured. Production requires a valid HTTPS INTERVIEW_AUTH_ORIGIN. No credentials are accepted from client-supplied origins.

## Verification

- npm run test:mobile:onboarding passes against loopback quesiq_local with every email mocked: disabled delivery/no account writes, concurrent signup, credential preservation, verification wrong owner/expiry/replay, scanner-safe GET, reset validation/expiry/concurrent links, refresh revocation, unknown email responses and HTTP body bounds. Test is included in test:mobile.
- Full native suite: 26 suites, 176 tests pass; mobile typecheck passes. Focused lint passes, mobile lint has no errors (62 warnings).
- Production build passes. Headless production HTTP check at 390px passes both forms, invalid-link POST errors, disabled-delivery 503 and blocked platform/development routes. Both page screenshots visually reviewed.
- Evidence: ignored artifacts/supabase-setup-2026-09-12/onboarding-build.log, onboarding-http.txt, onboarding-verify.png and onboarding-reset.png. Build initially caught a Windows text encoding issue; file normalized to UTF-8 and build rerun successfully.
- Main owns backend/auth, integration and checks. One Luna/medium worker implemented native screens and tests with one review pass. Per-agent usage unavailable.

## External input and activation

September 23 handoff: user reports login@quesiq.com and quira@quesiq.com verified and quesiq.com authenticated. Selected login@quesiq.com / QuesIQ Interview for account mail. User saved a key in ignored .env.brevo.local; expected API-key format and no surrounding whitespace verified, but Brevo GET /v3/senders and GET /v3/account returned HTTP401. The account response specifically reports an unrecognised source IP and points to https://app.brevo.com/security/authorised_ips. This is an IP-authorization blocker, not evidence of an invalid key. Full safe diagnostic/source IP is in ignored .codex-local/brevo-access-check.json; do not publish personal network addresses or keys.

No Brevo key was uploaded to Render and no email was sent. Next: authorize the intended local validation IP in Brevo (recheck it if the network changed), verify account/sender access, obtain the Render service's current outbound IP ranges and authorize those as needed, then merge the saved Brevo key and sender/origin settings into the existing service environment without replacing its database/auth secrets. Leave INTERVIEW_ONBOARDING_ENABLED=0 until ready for a bounded live test. Ask the user which recipient may receive verification/reset tests; the prior "done" confirmed saving the key, not a test recipient. Do not change Workspace mailbox routing, broaden IP access globally or expose keys in chat. Record API acceptance separately from actual inbox delivery and successful verification/recovery.

Provider AI activation, signed device builds and store release are not included. The current native build still needs its hosted API base URL when distributing a signed build.

## Hosted status

Render deployment dep-dalhjjrm8hqs739k74vg is live at source 94346d6520727def922cd038472118eaa7965d7d. Eight hosted HTTP checks pass: health 200, missing verification/reset tokens 400, all three email request endpoints 503 while disabled, Study and development sign-in 404. Initial probes during the rollout hit the previous version; repeated only after Render reported live. No hosted account was created or email sent. Evidence: onboarding-hosted-check.json in the ignored evidence directory. Automatic deployments remain off; documentation-only follow-up commits do not alter the deployed source.


September 23 read-only hosting refresh: Render reports live source94346d6 via deploy dep-dap313e7bikc73ep7fu0 (September22, trigger deployed_by_render). Auto-deploy remains off; /health returns200 and /study404. No deployment or environment mutation performed in the handoff turn.
