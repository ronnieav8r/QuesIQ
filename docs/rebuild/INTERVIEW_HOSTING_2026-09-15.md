# Interview dedicated backend hosting

Date: 2026-09-15. User authorized proceeding after verifying Render and GitHub access. This supersedes prior hosting deferral for a dedicated Interview service only; paid AI and device/release gates remain closed.

## Deployment design

- Existing repository ronnieav8r/QuesIQ, branch codex/interview-mobile; separate Render service quesiq-interview-api in Virginia, Starter compute ($7/month published starting price), automatic deployment off. Existing services remain suspended.
- QUESIQ_DEPLOYMENT=interview-mobile activates a default-deny proxy: only /health and /api/mobile/v1/interview/** are exposed; auth/dev-session is explicitly denied. Local platform routes remain unchanged when this flag is absent.
- Supabase analiejpwazwbeabpayp remains the database. A dedicated quesiq_interview_runtime role can read/write public application data but cannot administer schema/roles. Shared schema privileges follow existing server architecture; this is not per-product database isolation.
- Runtime connection uses verify-full TLS with the public Supabase root CA in config/supabase-ca.crt (downloaded from project Database Settings). New independent Auth.js and mobile token secrets are stored only in ignored .env.render-interview.local and service environment.
- No automatic migration at startup. All 97 canonical migrations are already applied. No AI, email, OAuth or test credentials are copied. NODE_ENV=production, INTERVIEW_BETA_ENABLED=0, test bypass flags off.

## Scope and outstanding work

Native sign-in currently has no signup/recovery flow. The hosted database has no learner accounts; a normal authenticated learner flow needs a separately completed Interview onboarding implementation. Do not expose the existing global signup pages without adapting their navigation and verification destination.

Hosting verification must include HTTPS /health, database-backed invalid-credentials response, unauthenticated protected routes and blocked platform/dev routes. Health alone does not verify the database. Never run seeded local suites against hosting.

This is initial API infrastructure, not a released mobile app or live AI activation. Native API origin, signup/recovery, provider readiness, signed builds and physical testing remain separate gates.

## Validation and service identity

Deployment is live: service srv-dakhv5tg1s2s73cd1ne0, deploy dep-dakhv6dg1s2s73cd1ou0, source ec33081d4a5002afab7ff5572b20239029f2bda3. URL: https://quesiq-interview-api.onrender.com (API only; root intentionally returns 404). Dashboard: https://dashboard.render.com/web/srv-dakhv5tg1s2s73cd1ne0.

Route-boundary unit test, focused lint, local production build and Render production build pass. Local HTTP check passes six routes. Hosted HTTPS check passes ten routes: health 200; root, Study, DPE, admin and development API paths 404; unauthenticated bootstrap 401; unknown-account password login 401 with invalid_credentials. That validly formatted login reaches the database query and confirms deployed database connectivity without creating an account. Separate TLS connection confirms runtime role and zero users. No authenticated token issuance or learner workflow has been tested.

Evidence: ignored artifacts/supabase-setup-2026-09-12/render-build.log and hosted-http-check.json. Render reports live. Automatic deployments remain off, so documentation-only follow-up commits do not change the deployed source. Main agent owns integration; one bounded inherited Astra worker performed a read-only auth/environment audit. Per-agent usage unavailable.
