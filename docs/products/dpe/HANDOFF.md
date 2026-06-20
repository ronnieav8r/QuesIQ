# QuesIQ DPE Handoff

Last updated: 2026-06-17

## Current State

DPE is open at `/dpe` in the shared QuesIQ app. The current learner practice
loop still supports the older button-driven DPE tables for compatibility, while
the content foundation is moving to DPE Content Model V2.

`0084_add_dpe_concept_variants.sql` added the first concept/variant foundation.
`0085_add_dpe_content_model_v2.sql` extends that foundation with first-class
stimulus packets, real scenario cases, and mock oral blueprints.

## V2 Content Rule

Concepts are narrow, source-backed knowledge or risk points. Drill variants are
the only variants attached directly to Concepts:

1. `multiple_choice`
2. `fill_blank`
3. `true_false`
4. `coaching`
5. `rapid_fire`

New concept imports must not include `scenario` or `mock_oral` variants. Those
are separate content families:

1. Scenario cases: ordered walkthroughs with setup, steps, checkpoints,
   linked Concepts, and linked stimulus packets.
2. Mock oral blueprints: voice-session plans with coverage policy, examiner
   style, allowed Concept/scenario pools, and instructions.
3. Stimulus packets: learner-visible assets plus AI-readable context. The AI
   must not be expected to infer chart/image meaning from pixels alone.

## Content-Side Prompt Suite

DPE V2 content generation prompts live in the content library, not in this app
repo:

```text
E:\Codex\QuesIQ\QuesIQ Content Management\QuesIQ Content Library\planning\dpe-v2-prompts
```

Start with `00_PROMPT_INDEX.md` before generating or converting DPE content.
Those prompts enforce the V2 workflow: reviewed source packet or exact
ACS-mapped Study row, narrow Concept extraction, Concept QA, drill generation by
mode, stimulus generation, scenario/mock oral generation, then import QA.

The prompt suite is a content-side drafting aid only. It does not import app
data, publish content, mark Official, mark app-side Verified, or mark
expert-reviewed.

## API Surfaces

Admin import:

- `POST /api/dpe/content/concepts`
- `POST /api/dpe/content/stimuli`
- `POST /api/dpe/content/scenarios`
- `POST /api/dpe/content/mock-oral`

Signed-in read:

- `GET /api/dpe/content/filters`
- `GET /api/dpe/content/variants`
- `GET /api/dpe/content/stimuli`
- `GET /api/dpe/content/scenarios`
- `GET /api/dpe/content/mock-oral`

Quick-practice variant APIs expose drill modes only. Scenario and mock oral are
kept separate until their runtime experiences are intentionally wired.

## Verification Commands

Run after DPE content-model work:

```powershell
npm run smoke:dpe-concepts
npm run typecheck
npm run lint
npm run readiness:dpe
npm run build
```

`readiness:dpe` may warn about missing local env vars outside a fully
configured app shell. Those warnings are not V2 content-model blockers.

## Next Builder Slice

Wire learner Practice setup to the V2 drill APIs first:

1. Keep certificate selection at the top.
2. Use task cards as the primary learner content boundary.
3. Make subject tags contextual to selected tasks.
4. Show only available drill modes.
5. Snapshot selected drill variants into `dpe_session_variants`.

Do not remove old DPE practice tables until V2 sessions, attempts,
History/review display, and deploy QA are complete.
