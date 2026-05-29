# Parallel Development

Last updated: 2026-05-29

## Rule

Products can move in parallel. Platform changes are serialized.

## Product Lanes

AI agents or developers may work in parallel when each change stays inside one
product lane:

- Interview: `src/components/interview`, current Interview server modules, and
  future `src/features/interview`
- Study: future `src/features/study` and product-owned routes
- QuesIQ DPE: future `src/features/dpe` and product-owned routes
- Marketing: future `src/features/marketing` and public marketing routes

Each product owns its own UI, product services, product copy, prompt configs,
and product database tables.

## Shared Lanes

Only one owner should change these at a time:

- `src/app/layout.tsx`
- root app shell/routing
- `src/auth.ts`
- `src/server/auth`
- `src/server/db/schema.ts`
- `drizzle/`
- `src/app/api/auth`
- shared account/admin/platform components
- shared CSS tokens and global styles
- `package.json`
- `next.config.ts`
- `tsconfig.json`
- `render.yaml`
- deploy, branch, or release docs

## Migration Rule

Drizzle migrations are serialized. One active owner creates and verifies
migrations at a time.

Product migrations should be named with the product or platform boundary when
practical, for example:

```txt
0047_platform_product_lanes.sql
0048_study_baseline_tables.sql
0049_pilot_dpe_sessions.sql
```

## Merge Order

Prefer this order when multiple branches are active:

1. Platform/auth/schema route-shell changes
2. Product module changes
3. Marketing changes
4. Integration QA and release promotion

## Agent Brief

Before starting product work, an agent should state its lane. If the task needs
shared files, the agent should call that out before editing them.

Example:

```txt
Lane: Study product module.
Shared files needed: none.
```

If shared files become necessary during implementation, pause and decide whether
to serialize that work with the current platform owner.
