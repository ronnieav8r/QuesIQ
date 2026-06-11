# Interview Industry Context Spike

Status: exploratory groundwork only. This spike should not change production
prompt behavior, runtime routes, Render config, or database schema.

## Value Proposition

QuesIQ Interview already passes target role, target company, job description,
resume summary, coaching memory, selected questions, and ranked story context
into turn-based and Realtime practice. Industry and role-family context packs
should make that context more useful without stuffing long background material
into every prompt.

The highest-value first slice is curated, compact context for common interview
domains:

- Better question choice: Que can ask questions that match the expectations of
  the industry and role family rather than generic behavioral prompts.
- Better coaching: Que can identify missing signals that matter for that domain
  while staying anchored to what the candidate actually said.
- Better evaluation: review feedback can weight role-relevant evidence without
  changing the locked five score dimensions.
- Better story matching: saved stories can be ranked against role-family and
  industry expectations, not only target role terms, resume terms, and coaching
  memory.

## Non-Goals

- Do not create a broad company research crawler in this spike.
- Do not inject long company dossiers into every session.
- Do not let Que invent employer facts, hiring processes, compensation details,
  interview loops, or current business conditions.
- Do not replace target company and job description context. Those are still
  the most user-specific inputs.
- Do not ship DB migrations until the product shape and admin workflow are
  settled.
- Do not move Interview code or prompt ownership out of the existing Admin
  prompt/catalog model.

## Pack Types

### Industry Packs

Industry packs describe durable interview expectations for domains such as SaaS,
healthcare, aviation, finance, retail, manufacturing, education, or government.
They should be mostly evergreen and reviewed on a slower cadence.

Recommended content:

- Common competency signals.
- Domain vocabulary Que may recognize but should not overuse.
- Useful question seeds by question type.
- Role-agnostic red flags and strong-answer signals.
- Story categories that commonly transfer well.
- Evaluation hints mapped to Confidence, Clarity, Relevance, Impact, and
  Authenticity.

### Role-Family Packs

Role-family packs describe expectations for broad job families such as customer
success, sales, operations, engineering, product, people leadership, aviation
operations, and training/instruction. These should be prioritized before company
packs because they are reusable and less stale.

Recommended content:

- Core competencies and likely target skills.
- Question seeds that fit practice modes and question types.
- Coaching hints for missing evidence.
- Story hints that help rank saved STAR stories.
- Evaluation hints that clarify what "relevance" and "impact" mean for this
  role family.

### Company Packs

Company packs should be later and lighter. They can go stale quickly and often
overlap with user-provided target company notes or a pasted job description.

Recommended first version:

- Admin-curated, explicitly dated, compact notes only.
- Optional employer values or interview emphasis if sourced and reviewed.
- No live company claims unless the source and review date are shown.
- Short expiration/review window, defaulting to review due after 30-60 days.
- Prompt guardrail that Que may say "based on your provided target context" or
  "if this is still current" rather than presenting claims as facts.

## Storage Model Proposal

Start with source-controlled fixtures or Admin-only draft JSON during the spike.
Move to Postgres only after the pack content shape survives QA.

Proposed future tables:

- `interview_context_packs`
  - `id`, `scope`, `key`, `title`, `description`
  - `industry_key`, `role_family_key`, `employer_name`
  - `status`, `version`, `summary_json`
  - `owner_note`, `last_reviewed_at`, `published_at`
  - `created_by`, `updated_by`, `created_at`, `updated_at`
- `interview_context_pack_sources`
  - `id`, `pack_id`, `source_label`, `source_url`, `source_note`
  - `retrieved_at`, `reviewed_at`, `created_at`
- `interview_context_pack_usage`
  - `id`, `session_id`, `user_id`, `pack_id`, `pack_version`
  - `match_reasons_json`, `score`, `injected_tokens_estimate`, `created_at`

Do not store generated company claims without an admin review path. Usage rows
matter because they let Admin inspect which pack versions influenced a session
or review.

## Retrieval And Ranking

Context selection should be deterministic first, with AI retrieval only as a
later optimization.

Inputs already available:

- `SessionSetupSnapshot.interviewContext.targetRole`
- `SessionSetupSnapshot.interviewContext.targetCompany`
- `SessionSetupSnapshot.interviewContext.jobDescription`
- structured resume summary from `resume_summary`
- selected question type and practice mode
- coaching memory
- saved story library context

Recommended ranking:

1. Match exact admin-pinned pack from a job target or future Admin override.
2. Match role-family from target role and job description terms.
3. Match industry from job description, resume summary relevant industries, and
   target company notes when present.
4. Match employer only when a published company pack exactly matches the target
   company and is not stale.
5. Cap selected context to one role-family pack, one industry pack, and at most
   one company pack.
6. Prefer newer reviewed packs when scores tie.

The selector should return compact snippets, not whole pack documents. A good
first cap is roughly 700-1000 words total for Realtime and less for turn-based
Rapid Fire/Coaching calls.

## Prompt Injection Points

### Turn-Based

`src/server/interview/turn-based.ts` builds a JSON payload for
`generateTurnDecision` with session components, candidate context, story
practice, saved story library, coaching memory, user archetype performance, and
question archetypes.

Future injection point:

- Add a `contextPacks` field next to `candidateContext`, containing ranked,
  compact snippets and match reasons.
- Keep the system prompt guardrail that the model must not invent company,
  resume, credential, metric, or motivation facts.
- Use context packs to influence question and target-skill selection, not to
  produce hidden analysis or long coaching reports.

### Realtime

`src/app/api/realtime/session/route.ts` composes Realtime instructions from the
active prompt config, mode/style/question prompt components, story context,
introduction context, ranked story library, target role/company, job target
context, coaching memory, resume summary, and a strict spoken-turn contract.

Future injection point:

- Add a short `formatContextPackSnippets(...)` block before the strict spoken
  contract.
- For Hands-Free Coaching, apply the same pack selector after selected-story
  context is stripped so the premium prompt does not accidentally become Story
  Practice.
- Include pack metadata in the `ai_runs.rawJson` setup metadata, but not full
  source text.

### Evaluation

Post-session evaluation should receive the same selected pack summaries used by
the session, ideally from a stored usage row or session snapshot reference. It
should use rubric hints to make feedback more relevant while preserving the
existing five dimensions.

## Latency And Caching Rules

- Pack selection must be local and fast for the first implementation.
- Do not call a model to classify every turn.
- Cache pack selection per session. Realtime setup and turn-based first turn can
  reuse the same ranked snippets.
- Cache role-family and industry classification on the job target or profile
  when that exists later.
- Company packs must have `lastReviewedAt` and should be excluded or downgraded
  when stale.
- Prompt snippets should be precomputed from pack JSON at publish time or cached
  by pack version.
- If pack retrieval fails, continue the session with existing target role,
  company, job description, resume summary, story, and memory context.

## Admin Curation Workflow

First admin workflow should be conservative:

1. Admin drafts a pack with scope, key, title, summary, question seeds, story
   hints, and evaluation hints.
2. Admin attaches source notes where the pack relies on external facts.
3. Admin previews the compact prompt snippet and estimated token size.
4. Admin runs the Prompt Test Tunnel against representative target roles and job
   descriptions.
5. Admin publishes a version.
6. Admin can archive a pack without deleting historical usage.

Company packs need an explicit review date and should default back to draft or
review-due when the review window expires.

## Model And Prompt Guardrails

- Que may use industry and role-family packs as interview expectations, not as
  facts about the user's actual experience.
- Que must not present company claims as current unless the user provided the
  claim in target context or an admin-reviewed company pack is current.
- Que should phrase uncertain employer context carefully: "If that is still
  accurate" or "based on the target context provided."
- Que must not coach the candidate to fabricate domain experience, metrics,
  credentials, or company-specific motivations.
- If context conflicts, prefer the user's pasted job description and resume over
  generic packs.
- If a company pack is stale, omit it or label it as background only.

## Staged Implementation Plan

### Stage 0: Spike Groundwork

- Document the architecture and risks.
- Add TypeScript-only pack shape scaffolding.
- No runtime behavior changes.

Acceptance criteria:

- New doc explains storage, retrieval, prompt injection, caching, admin workflow,
  migrations, guardrails, and open questions.
- TypeScript check passes if types are added.

### Stage 1: Offline Pack Prototype

- Create 2-3 draft packs as source-controlled JSON fixtures.
- Add a deterministic selector helper with unit tests.
- Add a debug-only script or admin preview that shows selected snippets for
  sample target roles and job descriptions.
- Do not inject snippets into live sessions yet.

Acceptance criteria:

- Selector returns stable ranked packs with match reasons.
- Snippet token budget is visible.
- No production prompt path changes.

### Stage 2: Turn-Based Prompt Test Tunnel

- Inject selected snippets only into admin/test-tunnel turn-based runs.
- Compare questions and coaching against baseline scenarios.
- Confirm no invented company facts.

Acceptance criteria:

- Prompt Test Tunnel shows better role-family/industry question fit in selected
  scenarios.
- Rapid Fire remains concise.
- Coaching still follows deterministic choice routing and does not loop.

### Stage 3: Realtime Admin QA

- Inject compact snippets into Realtime setup for admin-only QA.
- Track selected pack metadata in `ai_runs.rawJson`.
- Keep snippets under a hard size cap.

Acceptance criteria:

- Hands-Free Coaching and Mock Interview start without noticeable setup delay.
- Que uses pack context quietly and asks one question at a time.
- Saved story suggestions remain relevant and not forced.

### Stage 4: Productized Admin Packs

- Add migrations after the schema is validated.
- Add Admin CRUD/review/publish surfaces.
- Add usage audit rows for selected pack versions.

Acceptance criteria:

- Admin can publish, archive, and review-due packs.
- Historical sessions retain pack version references.
- Learner sessions gracefully omit unavailable packs.

## Open Design Questions

- Should role-family and industry classification live on job targets, profiles,
  or only session snapshots?
- Which pack keys should be first: broad industries, role families, or combined
  pairs such as `saas_customer_success`?
- Should company packs be internal-only until there is a source review UI?
- How much pack influence should evaluation receive versus question generation?
- Should Admin expose selected context snippets to admins on saved sessions for
  debugging?
- Do pack usage rows belong in Interview-owned tables only, or should future
  shared platform AI context usage use a generic table?
