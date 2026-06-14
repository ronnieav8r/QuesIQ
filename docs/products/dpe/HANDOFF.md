# QuesIQ DPE Handoff

Last updated: 2026-06-14

## Current State

DPE is open on the shared QuesIQ app route at `/dpe`. The current learner UI
still runs the existing button-driven DPE practice flow backed by the older
`dpe_oral_questions`, `dpe_session_questions`, and answer-attempt tables.

The latest backend slice added the new Concept + repeatable question-variant
content foundation in commit `018579e`.

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

## Next Builder Slice

Wire learner Practice setup to the new Concept variant APIs:

1. Move certificate selection to the top of Practice setup.
2. Add ACS area/task and subject tag filtering below certificate.
3. Add search across Concept search text, sources, tags, and prompts.
4. Show only modes available for the selected Concept/filters.
5. Start sessions from selected `dpe_question_variants`, snapshotting rows into
   `dpe_session_variants`.
6. Score visual modes deterministically from authored fields.
7. Keep coaching, rapid-fire, and mock oral grounded in authored prompts and
   rubrics.

Do not remove the old DPE practice tables yet. Keep compatibility until the new
variant-backed flow has session persistence, attempts, History/review display,
and deploy QA.

## Content Creator Handoff

Give content creators the prompt in:

`docs/products/dpe/CONCEPT_CONTENT_MODEL.md`

The importer rejects packets with no sources, no subject tags, or no variants.
Partial mode coverage is allowed; a Concept only appears in modes for which it
has complete variants.
