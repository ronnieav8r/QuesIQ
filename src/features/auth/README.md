# Auth Feature Lane

Shared authentication lives here when code is extracted beyond the current
Auth.js setup.

Current auth entry points remain:

- `src/auth.ts`
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/server/auth/`

Do not add product-specific profile fields to the generic Auth.js user model.
