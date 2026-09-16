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

No Brevo API key exists in the current local/new-service environment. User was asked which email service and verified sending address to use; do not ask for secrets in chat. After confirmation, configure the key through ignored local credentials or the provider dashboard, set AUTH_EMAIL_FROM and INTERVIEW_AUTH_ORIGIN=https://quesiq-interview-api.onrender.com, then enable onboarding. A real delivery/verification/recovery test to a user-approved recipient remains required; none was sent in this work.

Provider AI activation, signed device builds and store release are not included. The current native build still needs its hosted API base URL when distributing a signed build.

## Hosted status

Deployment pending; keep email delivery disabled until configured and validated.
