# Platform Readiness

Last updated: 2026-05-29

## Current Stance

QuesIQ is moving to a one-service modular platform. Interview, Study, QuesIQ DPE,
and future products should live in one repository and one primary web service
unless a real operational boundary appears.

The near-term goal is not a multi-service platform. It is a modular monolith:
shared auth/account/platform code, separate product routes and product data,
and clear file ownership so multiple AI agents or developers can work in
parallel without touching the same shared surfaces.

## Do Now

- Keep the current Interview beta stable while creating product lanes for Study,
  QuesIQ DPE, marketing, and future QuesIQ products.
- Preserve Auth.js `user`, `account`, `session`, and `verificationToken` tables
  as the generic identity layer.
- Keep product-specific data in product tables keyed by `user_id`. Interview,
  Study, and QuesIQ DPE should not add product-specific fields to the generic
  Auth.js user table.
- Keep global design tokens and reusable UI patterns product-neutral enough for
  the shared app shell, without extracting a separate package yet.
- Use disciplined branch and release flow before broader live traffic.
- Serialize shared platform changes, schema migrations, route-shell changes,
  auth changes, and release merges.
- Let product modules move in parallel when their changes stay inside their
  owned lane.

## Defer

- Shared billing and subscriptions.
- A separate auth service or `accounts.quesiq.com`.
- Separate Render services for each product.
- A shared Quira service boundary across products.
- Repo/package splitting for design system or platform services.
- Product membership, tenant, entitlement, or subscription tables unless a
  concrete launch need appears.

## Data Boundary

The current schema is acceptable for this stage:

- Auth.js identity is generic enough to become the shared account root later.
- Interview product records already hang off `user_id`.
- Product-specific fields should not be added to the generic `user` table.
- New Interview features should create or extend Interview-owned tables rather
  than turning the auth user record into a mixed product profile.

Study and QuesIQ DPE should add product-specific tables keyed by the same generic
user id before introducing a larger platform account model. Only add shared
product membership, entitlement, or billing tables when the requirements are
concrete.

## Design Boundary

The current design-system work lives inside the app through CSS tokens, shared
classes, and reusable React components. That is the right level for now.

For new UI work:

- Prefer existing tokens and component patterns.
- Keep primitive styling product-neutral where practical.
- Avoid copying large one-off style blocks when a small shared pattern already
  exists.
- Do not extract a package or separate design-system workspace until QuesIQ has
  at least two active product surfaces needing the same primitives.

## Separate-Service Trigger

Revisit separate services when at least one of these becomes true:

- Billing/subscriptions are required for a launch decision.
- Quira needs to serve multiple QuesIQ products from one knowledge/support
  surface.
- One product needs materially different scaling, deployment cadence, security,
  or runtime requirements.
- A separate native app identity needs a distinct backend boundary, not just a
  distinct marketing/store listing.
