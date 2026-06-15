# QuesIQ DPE Handoff

Last updated: 2026-06-15

## Current State

DPE is open on the shared QuesIQ app route at `/dpe`. The learner Practice
setup now has a guided flow from certificate, to focus filters, to practice
style and question count, but it still runs the existing button-driven DPE
practice loop backed by the older `dpe_oral_questions`,
`dpe_session_questions`, and answer-attempt tables.

The latest backend slice added the new Concept + repeatable question-variant
content foundation in commit `018579e`.

The latest learner setup slice landed in commit `8a62b75`
(`Redesign DPE practice setup flow`).

Implemented in that learner setup slice:

1. Certificate selection moved to the top of Practice setup.
2. ACS area/task focus changed from dropdowns to multi-select cards.
3. Subject/tag multi-select and prompt/source/keyword search were added.
4. Coaching and Rapid Fire remain the functional drill modes.
5. On-screen drills and Scenario/Mock Oral are separated as variant-backed
   mode groups for the next content-runtime slice.
6. Drill-style sessions now expose quick question-count choices plus a custom
   count.
7. Desktop and mobile browser checks passed; mobile stat overflow for long
   prompt-certificate labels was fixed.

Implemented in that slice:

1. Migration `0084_add_dpe_concept_variants.sql`.
2. Schema exports for Concepts, Concept sources, subject tags, question
   variants, variant assets, selected session variants, and attempts.
3. Admin-only Concept import endpoint at `/api/dpe/content/concepts`.
4. Signed-in filter endpoint at `/api/dpe/content/filters`.
5. Signed-in variant query endpoint at `/api/dpe/content/variants`.
6. DPE public status now includes `conceptVariantCount`.
7. Content creator prompt and model contract in `CONCEPT_CONTENT_MODEL.md`.
8. Smoke command `npm run smoke:dpe-concepts`.

## Content Model Rule

The new DPE content path uses Concepts as parent records, but Concepts are not
runtime blobs. Each Concept is one narrow, source-backed checkride idea under a
certificate and ACS area/task/element.

Required before import:

1. At least one source reference.
2. At least one subject tag.
3. At least one authored learner-facing variant.

Supported variant modes:

1. `multiple_choice`
2. `fill_blank`
3. `true_false`
4. `scenario`
5. `coaching`
6. `rapid_fire`
7. `mock_oral`

Practice must select stored authored prompts. AI may evaluate, coach, or
summarize spoken answers, but it must not invent learner-facing prompts at
runtime.

## Verification Commands

Run these after DPE content-model work:

```powershell
npm run smoke:dpe-concepts
npm run typecheck
npm run lint
npm run readiness:dpe
npm run build
```

`readiness:dpe` may warn about missing local env vars when run outside a fully
configured app shell. Those warnings are not concept-model blockers.

## Browser Review Decision

After reviewing the new Practice setup in the in-app browser, the next UX pass
should simplify the focus step before wiring the variant APIs:

1. Remove ACS Area as its own learner-facing selector.
2. Make Task selection the primary content boundary, labeled with area context
   such as `Area I, Task A: Pilot Qualifications`.
3. Keep task multi-select.
4. Keep subject/tag multi-select, but make tags contextual to selected tasks:
   tags available inside selected tasks stay active, while tags outside the
   selected task pool should be disabled/gray or hidden behind an intentional
   "show more" affordance.
5. Remove the search box from the primary learner setup flow for now. Tags
   should be the main learner-facing refinement control. Search can return
   later as an advanced/admin/content-browser tool when the content library is
   large enough to justify it.
6. Keep Scenario and Mock Oral visually separate from quick drills.

## Next Builder Slice

Wire learner Practice setup to the new Concept variant APIs after the task-first
UX cleanup:

1. Keep certificate selection at the top of Practice setup.
2. Replace learner-facing ACS area selection with task cards that include ACS
   area/task labels and descriptive task titles.
3. Make subject tags contextual to selected task cards.
4. Show only modes available for the selected Concept/filters.
5. Start sessions from selected `dpe_question_variants`, snapshotting rows into
   `dpe_session_variants`.
6. Score visual modes deterministically from authored fields.
7. Keep coaching, rapid-fire, scenarios, and mock oral grounded in authored
   prompts and rubrics.

Do not remove the old DPE practice tables yet. Keep compatibility until the new
variant-backed flow has session persistence, attempts, History/review display,
and deploy QA.

## Content Creator Handoff

Give content creators the prompt in:

`docs/products/dpe/CONCEPT_CONTENT_MODEL.md`

The importer rejects packets with no sources, no subject tags, or no variants.
Partial mode coverage is allowed; a Concept only appears in modes for which it
has complete variants.
