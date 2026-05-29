# One-Service Platform

Last updated: 2026-05-29

## Decision

QuesIQ should use one repository and one primary web service for the current
platform phase.

Public marketing and signed-in product experiences can use separate domains,
but they do not require separate Render services:

- `www.quesiq.com` for parent-brand and product marketing
- `app.quesiq.com` for the signed-in product shell
- `app.quesiq.com/interview` for QuesIQ Interview
- `app.quesiq.com/study` for QuesIQ Study
- `app.quesiq.com/dpe` for QuesIQ DPE
- `app.quesiq.com/account` for shared account/settings
- `app.quesiq.com/admin` for shared admin

## Architecture

Use a modular monolith:

- one Next.js app
- one Auth.js identity layer
- one Postgres database
- one Drizzle migration stream
- product-specific tables keyed by the shared Auth.js `user.id`
- product-specific route and feature folders
- shared account, auth, admin, design-token, and platform shell code

## Initial File Lanes

Current Interview code remains in its existing paths while the platform
boundary is established. New products should land in product-owned lanes.

Current route shell:

- `/` still serves the existing Interview beta entry point for production
  continuity.
- `/interview` also serves the existing Interview beta.
- `/study` is a placeholder product lane.
- `/dpe` is a placeholder product lane for QuesIQ DPE.
- `/account` is a placeholder shared account lane.
- `/admin` is a direct admin route for signed-in admin users, while the
  existing in-app Admin entry remains available.

Preferred long-term lanes:

```txt
src/app/
  (marketing)/
  (platform)/
    account/
    admin/
  (products)/
    interview/
    study/
    dpe/

src/features/
  auth/
  platform/
  marketing/
  interview/
  study/
  dpe/
```

Existing Interview code may be moved gradually after deploy QA confirms the
current beta remains stable.

## Data Boundary

The Auth.js tables stay generic:

- `user`
- `account`
- `session`
- `verificationToken`

Product data stays product-specific:

- Interview sessions, evaluations, stories, introductions, job targets,
  progression, and coaching memory stay Interview-owned.
- Study should add Study-owned tables.
- QuesIQ DPE should add DPE-owned tables.
- Shared billing, entitlements, and memberships wait until requirements are
  concrete.

## Service Boundary

Do not create separate Render services for each product by default.

Create a separate service only when the boundary buys something concrete:

- different runtime or scaling needs
- different deploy cadence that cannot share releases
- security isolation
- independent uptime requirements
- a true shared auth/billing/support backend needed by multiple apps

## Native App Direction

Keep the signed-in app shell clean enough to become a PWA and later a native
wrapper through a tool such as Capacitor. A single QuesIQ native app identity is
the easiest first maintenance path. Separate native app listings can be added
later for products like QuesIQ DPE if app-store search and market positioning
justify the extra release overhead.
