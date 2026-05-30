# Parallel Development

Last updated: 2026-05-30

## Rule

Products can move in parallel. Platform changes are serialized.

## Product Lanes

AI agents or developers may work in parallel when each change stays inside one
product lane:

- Interview: `src/features/interview`, `src/components/interview`,
  Interview-owned API routes, and Interview-owned server modules for sessions,
  stories, introductions, debriefs, progression, feedback, and coaching memory
- Study: `src/features/study`, `src/server/study`, `src/app/study`,
  `src/app/api/study`, `scripts/study`, and `docs/products/study`
- QuesIQ DPE: `src/features/dpe`, `src/server/dpe`, `src/app/dpe`,
  `src/app/api/dpe`, and `docs/products/dpe`
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

Shared env/key routing also belongs to the platform lane. Product workers should
use existing helpers such as `getOpenAiApiKey("study")` and
`getOpenAiRealtimeApiKey("dpe")`; they should not invent new environment
variable names inside product code.

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

## Clone Guardrails

The current local parallel setup uses one manager clone and three worker clones:

```txt
QuesIQ-manager   -> main, manager/integration
QuesIQ-interview -> codex/interview
QuesIQ-study     -> codex/study
QuesIQ-dpe       -> codex/dpe
```

The manager thread sends work to the worker threads, reads their handoffs,
reviews diffs, runs lane guards, merges one branch at a time into `main`, and
pushes `main`. Workers should not merge or push `main`.

Before merging a worker branch, the manager should run:

```txt
npm run guard:interview -- origin/codex/interview
npm run guard:study -- origin/codex/study
npm run guard:dpe -- origin/codex/dpe
```

The lane guard checks changed files against allowed path prefixes. It does not
replace review, but it catches obvious cross-lane edits before merge.

Worker handoffs should include summary, files changed, commits, checks run,
risks, and whether the worker branch was pushed.

## Branch Sync States

The manager keeps a branch state board for product lanes:

```txt
Interview: idle | active | awaiting handoff | needs rebase | ready for review | merged | blocked
Study:     idle | active | awaiting handoff | needs rebase | ready for review | merged | blocked
DPE:       idle | active | awaiting handoff | needs rebase | ready for review | merged | blocked
```

After `main` changes, the manager only fast-forwards branches in the `idle`
state. Branches in `active` or `awaiting handoff` are not reset. Instead, the
manager marks them `needs rebase` and tells the worker to update from
`origin/main` before final handoff.

If the active branch touches shared/platform files, the manager should pause or
serialize that work rather than letting multiple lanes drift across the same
files.

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
