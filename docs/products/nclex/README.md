# QuesIQ NCLEX

QuesIQ NCLEX is a structural spike for an NCLEX-RN practice lane. It follows the
DPE pattern where content, learner sessions, admin review, and readiness checks
live in a product-specific lane instead of leaking into Interview, Study, or DPE.

## Current Scope

- Learner route: `/nclex`
- Admin route: `/admin/nclex`
- API prefix: `/api/nclex/*`
- Feature code: `src/features/nclex`
- Server code: `src/server/nclex`
- Database prefix: `nclex_`
- First exam track: `NCLEX-RN`

The core contract is deliberately deterministic:

- app code selects reviewed questions;
- app code scores against authored answer keys;
- app code updates category and clinical-judgment stats;
- AI is not used for item selection, correctness scoring, or progression.

AI may later support explanations, draft authoring, admin classification, or
support workflows, but those paths must remain separate from the learner scoring
contract.

## V1 Data Model

Migration `drizzle/0082_add_nclex_baseline.sql` adds:

- `nclex_exam_tracks`
- `nclex_client_need_categories`
- `nclex_clinical_judgment_steps`
- `nclex_content_versions`
- `nclex_questions`
- `nclex_case_studies`
- `nclex_case_items`
- `nclex_user_profiles`
- `nclex_practice_sessions`
- `nclex_session_items`
- `nclex_user_category_stats`
- `nclex_user_judgment_step_stats`

The first taxonomy seed covers NCLEX-RN client need categories and NCSBN-style
clinical judgment steps. The question bank intentionally remains content-gated:
learner practice only uses active, published questions.

## Learner Shape

The first scaffold supports:

- adaptive readiness;
- category focus;
- missed-question review;
- deterministic next-item selection;
- per-item answer scoring;
- simple session summary with weak categories and judgment steps.

NGN case-study surfaces and richer item renderers are represented in the schema
and route boundaries but are not complete learner experiences yet.

## Admin Shape

The first admin route shows:

- taxonomy and storage diagnostics;
- confirmation that scoring is deterministic;
- published question library preview.

Future admin work should add import/preview/review flows before exposing any
larger NCLEX content set to learners.

## Readiness

Run:

```powershell
npm run readiness:nclex
npm run guard:nclex -- HEAD
```

The readiness check verifies lane files, schema/migration markers, deterministic
selection/scoring markers, learner/admin route markers, and the no-AI scoring
boundary.
