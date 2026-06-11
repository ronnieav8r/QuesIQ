# QuesIQ Interview

QuesIQ Interview is the current lead coded product and should remain stable
while the repository becomes the shared QuesIQ platform tree.

Planning notes:

- `docs/products/interview/INDUSTRY_CONTEXT_SPIKE.md` covers exploratory
  groundwork for industry, role-family, and employer-specific context packs.

## Current Code

Most current Interview code still lives in the original rebuild paths:

- `src/features/interview/interview-app.tsx`
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

## V1 Readiness (Non-Voice / Non-Browser-QA)

Run the static Interview readiness check:

```bash
node scripts/interview/readiness-check.mjs
```

This check is deterministic and does not require a dev server, browser,
database, or voice hardware. It reports PASS/WARN/FAIL counts and exits nonzero
only when FAIL blockers are found.

Current static readiness checklist:

- Key Interview pages, routes, and server modules exist.
- First-turn prompt shared source is visible from Interview session code.
- Catalog fallback behavior is present, and fallback catalog excludes legacy
  First Impression mode keys.
- Review timing rules are present and statically enforced markers exist.
- Admin-visible prompt-composition markers exist on Interview Realtime setup.
- Auth/session ownership guard markers exist on key Interview routes.
- AI usage instrumentation markers exist on key Interview AI/realtime paths.
- Required Interview env var presence is reported as WARN when local env is
  missing.
- Voice QA and production browser QA remain manual/unavailable in static check
  output and are never marked as passed by this script.

## Progression Notes (V1)

- Practice mode quest coverage now tracks the active non-premium Practice set:
  Coaching, Rapid Fire, and Question Queue.
- Mock Interview and Hands-Free Coaching are Premium-labeled because they use
  realtime ChatGPT/audio, and premium live modes use separate quest coverage.
- Question Queue launches through Rapid Fire as an end-only Rapid review flow:
  exact queued questions are preserved, answers are evaluated into per-question
  cards, and feedback is shown after the queue ends.
- Quest and XP progress for button-driven modes uses answered practice turns,
  not idle session time.
- Retired First Impression remains disabled for normal Practice questing.
- Story Lab quest coverage includes first saved Introduction, first saved TMAAT
  story, and a deeper TMAAT story-bank quest at three saved stories.
