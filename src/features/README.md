# Feature Lanes

This folder is the landing zone for the one-service QuesIQ platform structure.

The current Interview rebuild still lives mostly in the original paths. Move it
gradually only when a scoped change requires it.

Use these lanes for new work:

- `auth/` for shared authentication helpers beyond the Auth.js route itself
- `platform/` for shared account, shell, admin, product-switching, and platform
  services
- `marketing/` for public marketing surfaces
- `interview/` for QuesIQ Interview features as they are gradually moved
- `study/` for QuesIQ Study
- `dpe/` for QuesIQ DPE

Before editing shared platform files, check `docs/platform/PARALLEL_DEVELOPMENT.md`.
