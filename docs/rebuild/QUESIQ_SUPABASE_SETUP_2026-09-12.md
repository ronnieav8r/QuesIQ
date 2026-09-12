# QuesIQ Supabase setup

Date: 2026-09-12. User authorized preparing/applying the new hosted database schema and connecting the backend. Local PostgreSQL remains development/testing only; no local data export to hosting is authorized or needed.

## Verified target

- Supabase organization: A2RKS (Pro).
- Project: QuesIQ, reference analiejpwazwbeabpayp, main production branch.
- Dashboard: https://supabase.com/dashboard/project/analiejpwazwbeabpayp
- Region: East US (North Virginia), us-east-1; Micro compute; dashboard reports Healthy.
- User created the project. Creation form displayed an additional $10/month; no billing reconciliation performed.
- Database endpoint verified through Connect > Direct > Session pooler: aws-0-us-east-1.pooler.supabase.com:5432, database postgres, user postgres.analiejpwazwbeabpayp. Direct endpoint uses IPv6; session pooler provides an IPv4 path without the paid IPv4 add-on.
- Data API was enabled after creation. Disabled it and verified the saved off state. QuesIQ uses Auth.js identities in public.user and server-side Drizzle, not Supabase Auth identities or browser database access.

## Local preparation completed

- Worktree: QuesIQ-dev, codex/interview-mobile, baseline01f8f2f. One Luna/medium worker performed a read-only migration audit; main reviewed the findings and owned the rehearsal/tooling. No measured per-agent usage claim.
- Canonical journal contains97 migrations through0097, with intentional numbering gap0004. All97 applied successfully to a new disposable local database; second pass reports already current.
- Local custom-format backup restored into another new disposable database; restored journal97, users0, sessions0. This is local rehearsal evidence, not a hosted backup/restore guarantee. Existing quesiq_local data was unchanged.
- Full production build passes (123 static pages, TypeScript passes). Build DATABASE_URL resolves to loopback5433. Next's generated route-type import restored to its original value after the build.
- scripts/interview/supabase-bootstrap.mjs defaults to read-only inspection. --apply requires the exact reviewed project/endpoint, verified TLS, an empty public schema and empty migration journal. It invokes the canonical runner, checks all migration hashes/timestamps, verifies users/sessions/AI runs remain empty, and removes anon/authenticated public table/sequence grants and future defaults. Syntax and focused ESLint pass. Hosted schema application and independent read-only verification now pass: 97 migrations, 132 public tables, zero users, sessions and AI runs, and zero anon/authenticated table grants.

## Seed and scope boundary

The canonical one-platform journal creates shared auth plus all existing product tables and built-in catalogs/prompts, including Study/DPE/NCLEX/Quira reference rows. It has no supported Interview-only filtered replay. This follows the selected shared QuesIQ project architecture; it does not activate those product lanes or import their content packs. No learner accounts, test passwords, profiles, sessions or user content are inserted by migrations.

Historical pricing seed dates to May2026 and is not current tariff verification. Keep provider dispatch blocked, all paid beta budgets unset and P6.6 excluded. Never run local service/browser seed suites against this hosted database.

## Hosted database completed

- User saved the password in ignored .env.supabase.local. No DATABASE_URL was added; local testing remains on its separate database.
- Empty hosted schema and identity verified before applying all 97 canonical migrations. All journal hashes/timestamps matched; a separate read-only connection confirmed 132 public tables, zero users/sessions/AI runs and zero anon/authenticated public table grants.
- TLS verifies the hostname and certificate chain using the official Supabase Root 2021 CA downloaded from Database Settings into ignored artifacts/supabase-setup-2026-09-12/supabase-ca.crt. Initial system trust failure was resolved by supplying the CA, without disabling verification. Bootstrap requires this certificate file.
- Public CA download: https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt
- Bootstrap is one-time only and refuses to apply to this now-populated schema. Future migrations need a reviewed incremental path.

## Pending hosting choice and next operations

1. Hosting choice pending: Render already has suspended Dev.QuesIQ (srv-d8l8t8l7vvec73f24510), Virginia, Starter, main branch, auto-deploy off. Reuse would resume compute billing (published Starter about$7/month). User approval requested. No service resumed, environment changed, push or deployment performed.
2. Before connecting a backend: pin reviewed source, establish server-only runtime credentials, keep development/test bypasses off and paid/provider guards blocked, confirm auth/email setup and production routes, then verify HTTPS/database/sign-in. Do not attach current test credentials or deploy all platform lanes merely because the build passes. Existing quesiq-web/live service and other projects remain untouched.

## Evidence and sources

Ignored logs: artifacts/supabase-setup-2026-09-12 (migration first/second pass, row inventory, custom backup/restore and production build). Hosted preflight, redacted migration log, exact journal verification and independent read-only check are also saved there.

- https://supabase.com/docs/guides/database/drizzle
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/guides/platform/ssl-enforcement
- https://render.com/pricing
