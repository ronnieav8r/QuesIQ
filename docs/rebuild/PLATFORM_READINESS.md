# Platform Readiness

Last updated: 2026-05-28

## Current Stance

QuesIQ Interview remains the lead product. Do not merge QuesIQ Study or build a
shared platform shell yet. The near-term work is still proving and hardening the
Interview beta: voice practice, review quality, Story Lab, job targets,
progression, feedback, and production reliability.

Platform integration is a later phase. The correct work now is to keep the
current app shaped so the later platform is possible without slowing beta
learning.

## Do Now

- Keep Interview as the product that drives implementation decisions.
- Preserve Auth.js `user`, `account`, `session`, and `verificationToken` tables
  as the generic identity layer.
- Keep Interview-specific data in product tables keyed by `user_id`, such as
  profiles, job targets, sessions, evaluations, stories, introductions,
  progression, feedback, and coaching memory.
- Keep global design tokens and reusable UI patterns clean enough to extract
  later, without creating a separate package before there is a second active
  product using it.
- Use disciplined branch and release flow before broader live traffic.
- Label future platform plans as strategy unless the active decision docs say
  they are current implementation work.

## Defer

- Shared billing and subscriptions.
- A cross-product account dashboard.
- A shared platform navigation shell for Interview and Study.
- A QuesIQ Study merge into this app.
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

If QuesIQ Study becomes active later, prefer adding Study-specific tables keyed
by the same generic user id before introducing a larger platform account model.
Only add shared product membership, entitlement, or billing tables when the
requirements are concrete.

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

## Platform Later Trigger

Revisit true platform integration when at least one of these becomes true:

- QuesIQ Study has an active coded product path that needs shared login.
- Billing/subscriptions are required for a launch decision.
- Quira needs to serve multiple QuesIQ products from one knowledge/support
  surface.
- The Interview beta has enough usage that account, billing, or support
  workflows are more important than core practice-loop iteration.
