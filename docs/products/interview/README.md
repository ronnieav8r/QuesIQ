# QuesIQ Interview

QuesIQ Interview is the current lead coded product and should remain stable
while the repository becomes the shared QuesIQ platform tree.

## Current Code

Most current Interview code still lives in the original rebuild paths:

- `src/app/page.tsx`
- `src/components/interview/`
- `src/product/`
- `src/server/sessions/`
- `src/server/stories/`
- `src/server/introductions/`
- `src/server/debriefs/`
- `src/server/progression/`
- Interview-related API routes under `src/app/api/`

Do not move large Interview surfaces during unrelated Study, QuesIQ DPE, or
marketing work. Gradual relocation to `src/features/interview/` is allowed only
when it is scoped, verified, and does not disrupt the current beta.

## Boundaries

Interview owns:

- voice practice sessions
- Story Lab and introductions
- job targets
- interview evaluations
- verbal debriefs
- Interview progression, quests, and XP rules
- Interview coaching memory
- Interview prompt configs and AI usage records

Shared platform owns auth, account, admin shell, release flow, and product
selection.
