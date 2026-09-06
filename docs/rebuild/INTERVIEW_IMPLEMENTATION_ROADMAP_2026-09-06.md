# QuesIQ Interview — implementation roadmap and agent operating plan

Date: 2026-09-06

Status: approved and active implementation plan, authorized 2026-09-06. Implement in sequence using the lowest suitable worker model/reasoning and manager acceptance gates. Read `INTERVIEW_EXECUTION_STATUS.md` for the current checkpoint and next unaccepted task. One GPT-5.6 Luna agent performed a bounded read-only acceptance-gate review during planning; that is not implementation evidence.

Source: `INTERVIEW_PRODUCT_REVIEW_2026-09-06.md`, current handoff/status/decisions, and `INTERVIEW_REGRESSION.md`. Existing implementation and test results are starting evidence, not acceptance of the changes below.

## 1. Outcome and boundaries

Build a dependable mobile-first interview coach that helps a learner prepare truthful examples, practice an answer, understand evidence-backed feedback, retry, compare attempts, and choose useful next practice.

Keep one product/backend, the native Expo app, and a stable Next.js web fallback. Keep the mirrored iPhone/Pixel browser test bed as the default local development surface; do not confuse it with native certification.

Non-negotiable boundaries:

- Interview only, in QuesIQ-dev on the current `codex/interview-mobile` lane unless deliberately changed later.
- Preserve the pre-existing dirty worktree; no blanket staging, resets, cleanup, or destructive migrations.
- No push, Render, EAS deployment, store submission, production database change, or credential migration.
- No direct user desktop/browser/emulator control. Terminal and isolated headless verification only while this constraint remains active.
- Default test bed stays `Test Coaching · no audio`, Fit, Simulation, no automatic provider requests or test creation.
- No retained raw candidate audio. Pending-artifact recovery stores transcript and metadata only. Generated TTS cache is temporary and cleaned up.
- Keep local inspection/test records out of learner History, progression, recommendations, and coaching memory.
- Paid AI comparisons, live audio, physical-device testing, and release activation require separate scoped authorization/readiness. A plan is not authorization to run an unbounded paid evaluation suite.

## 2. Cost-conscious agent operating model

### Roles and routing

| Role | Default | Assignment |
| --- | --- | --- |
| Manager | Current main-task model | Product decisions, task boundaries, interface design, risk review, integration, final acceptance |
| Focused worker | GPT-5.6 Luna, low for clear small tasks; medium only when warranted | Small UI changes, deterministic tests, bounded API fixes, adapters against frozen contracts, documentation |
| Escalation worker | GPT-5.6 Terra, medium/high as warranted | Cross-file service logic, migrations under manager design, nontrivial lifecycle work, difficult debugging |
| High-risk work | Manager; stronger worker only if warranted | Authentication, ownership, migration/rollback design, idempotency, concurrency, prompt/evaluation policy, architecture |

The available subagent tools support explicit model selection. Names above are verified available in this session; verify availability again when execution starts. Do not silently substitute an expensive model if a requested worker is unavailable.

Default to one manager plus one worker. Use a second worker only for independent file ownership after interfaces are frozen. This session supports up to four agents including the manager; capacity is not a reason to fill all slots. No recursive delegation. Do tiny obvious tasks directly when a handoff costs more than the work.

### What saves cost

Delegation can increase total tokens while reducing weighted cost: a cheaper worker does most implementation, and the manager reads a bounded diff and evidence rather than repeating the work. It becomes wasteful when every agent receives the whole history, independently redesigns the architecture, edits overlapping files, or repeats failed attempts indefinitely.

Use fresh, bounded worker context, not a full conversation fork. Include the applicable AGENTS instructions, exact paths, decisions, contracts, and test commands needed for that task. Do not make workers rediscover the repository.

The manager must inspect code and relevant surrounding invariants, not merely accept a worker summary. Review depth scales with risk. Do not reread all unaffected code or replay every successful tool log.

One correction round is the default per task. After that, diagnose whether the brief, scope, or model was wrong; narrow, escalate, or take over. Do not pay for repeated blind retries. This is a workflow limit, not an enforced token/billing cap.

### Two distinct spending ledgers

1. **Development assistance:** manager and worker tokens/credits or included Codex usage. Worker use and local reviews are not free. Record actual model, effort, elapsed time, corrections, and usage if the tools expose it. If per-agent usage is unavailable, mark it unknown; account-wide usage changes are not reliable task attribution when other work is running.
2. **QuesIQ runtime/testing:** transcription, text generation, TTS, Realtime, evaluation, and retries charged through app APIs. No live calls during deterministic work. Each paid experiment needs a bounded case count, request/response limits, an estimated spend ceiling, and a stop policy before execution. Estimates are not guaranteed hard provider caps.

Cost objective: accepted feature cost, including review and rework—not raw token count or the nominal price of the smallest model. Do not promise a savings percentage without measured evidence.

### Worker task packet

Every task gets:

- ID, one outcome, prerequisites, model/effort, and explicit stop conditions.
- Exact baseline and owned files; files that must not be touched.
- Interface/schema examples, behavior examples, compatibility requirements.
- Required tests, allowed local data scope, and no-paid-call/no-PC restrictions.
- Expected handoff: files changed, concise rationale, commands/results, evidence paths, unresolved risks. Target a short handoff, with logs in artifacts.

Workers may not commit, merge, activate prompts, alter shared configuration, add dependencies, or run migrations unless the task explicitly assigns that authority. One writer per shared contract, schema, lockfile, central service, or instruction document.

### Integration mechanics

In the current shared filesystem, worker changes appear immediately; a worker is not automatically in an isolated branch. For the initial single-worker pilot, freeze overlapping edits and review the working diff against the recorded checkpoint. Do not describe that as a merge.

For later independent coding lanes, create explicit local worktrees from an accepted checkpoint if isolation is worthwhile. Do not create separate user-owned Codex tasks merely to obtain workers. The manager alone integrates isolated changes, resolves conflicts, runs combined checks, and checkpoints accepted slices. Do not run multiple database-mutating suites concurrently against the same test user/database.

## 3. Architectural decisions to freeze before broad coding

### Effective mode configuration

Introduce one authoritative resolved configuration including mode, enabled status, engine, text/transcription/TTS/Realtime models as relevant, voice, limits, and version/source. It must drive catalog visibility, backend execution, native routing, and inspector explanation. Preserve explicit configured-versus-effective values while old overrides are retired.

Snapshot the resolved configuration and prompt/rubric versions when a session starts. A configuration change applies to new sessions, not halfway through an active one. Do not enable a new engine until that mode's capability checks and acceptance tests pass. The first config cleanup must preserve current behavior; changing Rapid Fire routing is a later explicit rollout.

### Application-owned exercise state

Proposed shared concepts: question ID/text, primary-question index, attempt ID/index, session status, allowed actions, operation ID, expected state revision, and pending request status. Final names belong to the manager's contract review, not independent worker invention.

States cover setup, awaiting answer, processing, feedback/choice, completed, saving, and recoverable failure. Voice adds listening/speaking/connection states without owning question advancement. Old/double requests must not advance a second time. End dominates late events. Retries and clarification requests do not consume primary-question count.

The typed inspector and native exercise use the same server/controller behavior, with separate input/output adapters. Share portable UI where practical; do not undertake a wholesale React Native Web rewrite as a prerequisite.

### Feedback and attempts

Preserve original and delivered responses, validation outcomes, evidence references, one priority improvement, question/rubric/model versions, and parent/attempt relationships. Keep old reviews readable with optional fields and compatibility mapping. Do not silently rescore historical sessions or mix guided and unassisted scores.

Use server-owned authoritative context. Treat resume text, job descriptions, transcripts, and imported stories as untrusted content, never privileged instructions. Filter context by authenticated owner. Capture the relevant context/version in the trace without exposing secrets.

## 4. Delivery phases and acceptance

### Phase 0 — Recoverable baseline and delegation pilot

**Purpose:** make subsequent work safe and measure whether the lower-tier workflow helps.

Tasks:

- Record branch/HEAD, changed and untracked files, local service/test configuration, and existing known failures. Review what belongs to Interview before making a local checkpoint; preserve unrelated work separately without deleting it.
- Verify ignored secrets/artifacts and a recoverable local database backup before schema changes. Do not unnecessarily reinstall dependencies or restart working services.
- Run the deterministic baseline once and save results. Resolve or explicitly classify failures before attributing them to workers.
- Pilot task P0.1: replace the saved-session detail endpoint's recent-100 search with a direct owned lookup while preserving its response contract. Include tests for a record older than 150 newer sessions, another user's record, nonexistent ID, and unauthenticated access. No schema change, UI redesign, or model request.
- Manager reviews the diff, verifies regression evidence, and records worker versus review/rework effort. This pilot is a usability check of delegation, not a statistically controlled cost benchmark.

**Gate:** recoverable checkpoint; baseline recorded; direct lookup passes ownership/age cases; no unrelated diff. If Luna requires repeated redesign or extensive repair, assign similar subsequent work to Terra or shrink it.

### Phase 1 — Single source of truth and deterministic state

**Purpose:** remove configuration ambiguity before tuning output.

Work packages:

- P1.1 manager designs effective-mode and exercise-state contracts; tests freeze invariants.
- P1.2 worker implements configuration resolution and configured/effective inspector reporting without changing enabled engines.
- P1.3 worker implements controller/reducer and operation-boundary validation against the frozen contract.
- P1.4 integrate catalog-driven native setup, active-job-target defaults, session snapshots, and native/server/inspector parity.

**Gate:** displayed engine/model/voice matches the executed request in mocked integration tests; disabled modes cannot launch; wrong/stale state revisions are rejected safely; double taps and late results do not duplicate turns; retries preserve the question; primary counts remain correct. Existing web behavior and saved snapshots remain compatible.

**Parallelism:** fixtures or inspector presentation may run alongside controller work only after interfaces and file ownership are frozen. Configuration, shared contracts, and central service changes are serialized.

### Phase 2 — Trustworthy Coaching prompts and evaluation harness

**Purpose:** improve both instruction adherence and answer-specific value.

Work packages:

- P2.1 write a mode behavior specification and examples for answer, retry, more feedback, clarification, next, end, empty/partial input, and off-topic requests.
- P2.2 separate question generation, answer feedback, and clarification prompts; remove contradictory planner/responder/mode instructions. No model call for a deterministic UI transition alone.
- P2.3 bound context to relevant target/resume/story facts, current question, answer, and selected recent turns. Use separate emphasis for behavioral, motivational, situational, and technical answers.
- P2.4 replace always-passing repair reporting with separate raw schema validity, behavioral validity, correction/rejection, and delivered-quality results. Structural checks remain deterministic; semantic checks are tested and human-calibrated, not claimed solved by a keyword heuristic or another LLM alone.
- P2.5 require supported evidence and one priority improvement; suppress invented details, unsupported personal-trait judgments, and pressure to fabricate achievements. Handle insufficient information explicitly.
- P2.6 extend current local traces/CSV/JSON, rather than building another admin area. Keep raw versus delivered text, effective configuration, prompt versions, state transitions, usage, and selected evidence inspectable per turn.

**No-audio gate:** deterministic behavior and adversarial fixtures pass; no inspection data leaks into learner memory; provider errors, invalid output, uncertain generation, and retries preserve existing no-double-billing protections.

**Paid-text quality gate, separately authorized:** start with a small screened set, then a held-out matrix across at least four role families and two experience levels. Cover weak, strong, unusual, long, short, ambiguous, and adversarial answers. Repeat critical behavior cases; do not tune against the holdout. Proposed promotion targets: no observed severe role/ownership/fabrication violations, at least 95% behavioral compliance in the declared sample, and useful/grounded human ratings on a blinded sample. Report repair rate separately. These are release targets, not guarantees or current results; calibrate sample size and budget before running.

New prompt versions remain draft/local candidates until the manager reviews differences and activates them in a controlled local test. Preserve the prior version and ability to revert new-session selection.

### Phase 3 — Reliable reviews and visible improvement

**Purpose:** close the learning loop using typed input before audio is required.

Work packages:

- P3.1 lightweight cursor-paginated History summaries; direct detail loading from P0.1; stable ordering with timestamp/ID; explicit loading, empty, expired-auth, and error states.
- P3.2 evaluation polling with backoff, real pull-to-refresh, safe explicit retry after confirmed failure, and eligibility copy driven by shared rules. A stale processing lease/uncertain provider result must not silently trigger another paid evaluation.
- P3.3 expose existing evidence and next-step fields; show one improvement and a linked transcript excerpt before the full scorecard.
- P3.4 persist attempt relationships and offer same-question retry with side-by-side evidence. Additive schema only if existing records cannot represent this cleanly; manager reviews migration and backward compatibility.
- P3.5 distinguish assisted retry from unassisted performance. Preserve historical scores/versions; do not claim improvement merely from different model/rubric output.
- P3.6 keep inspector test reopening separate from real learner History. Use isolated synthetic learner records to test the real History path without polluting the user's account.

**Gate:** typed answer → feedback → same-question retry → comparison → persistence → reload works in both preview/controller tests and native component tests. Old sessions beyond 150 records open; no cross-user lookup; pending/failed/completed/too-short states recover; no duplicate evaluation. User-facing screen changes have both framed browser evidence and an explicit Expo parity checklist.

**Dependencies:** P3.1/P3.2 can proceed independently after P0 and review-response contracts are frozen; attempt comparison waits for P1 state and P2 feedback structure.

### Phase 4 — Native experience and audio responsiveness

**Purpose:** make the real phone app match the approved experience and stop treating silence as consent to submit.

Work packages:

- P4.1 port approved Home/Practice/session/review/Me layouts using shared design tokens and reusable native components. Preserve safe areas, scalable text, clear focus, adequate touch targets, and keyboard/scroll behavior. No hardcoded demo role or scores in live screens.
- P4.2 accumulate transcript segments and make Done answering authoritative for controlled practice. Handle finalization acknowledgements and late transcript events; do not assume the latest delta is the complete answer.
- P4.3 explicit listening/processing/speaking/choice UI; captions default collapsed; text fallback; mute/end always understandable. No invisible recording on background or interruption.
- P4.4 stage telemetry: answer end, transcript final, model start/end, validation, TTS first byte, player first audio. Record comparable end-to-first-audio P50/P95, failure/recovery, and request IDs.
- P4.5 bounded feasibility spike for streaming approved TTS through the actual native player. Validate the whole coaching artifact before playback; stop/cleanup correctly; preserve full-file playback as fallback if streaming is not reliable. Limit spoken menus; cache only appropriate generic clips, with versioning and cleanup.
- P4.6 complete spool/restart, audio interruption, connection loss, late response, double End, microphone denial/retry, and pending-save recovery checks.

**Automated gate:** component/controller/network-mocked tests and native compilation pass. Headless frames pass small/large layout checks. No claim of heard audio or native keyboard quality from browser screenshots.

**Manual gate, later:** operator microphone/speaker/transcript test, pause handling, real player start timing, app interruption, and restart/reopen proof. Proposed latency targets on a declared device/network: median <=2 seconds and P95 <=4 seconds from Done to first Que audio; establish a comparable baseline first and treat targets as provisional, not promised results. Native proof must meet both existing smoke and certification profiles.

### Phase 5 — Complete the four-mode offering

**Purpose:** reuse the controlled engine without turning every exercise into a conversation.

- First Impression: one introduction question, one useful critique, optional retry; role-appropriate evaluation, no unnecessary question-focus setup.
- Rapid Fire: fixed primary-question count, deterministic advancement, concise questions, brief or batched feedback. Decide the feedback timing once in the mode spec; default to summary after the run so pacing remains distinct from Coaching.
- Coaching: retain explicit choice and same-question iteration.
- Mock Interview: Realtime interview behavior, relevant follow-ups, no mid-interview coaching by default, evaluation afterward. Keep premium/full model selection configurable; compare Mini only through a bounded experiment, not an automatic replacement.

**Gate:** each mode's catalog, route, prompt, state, saved artifacts, review eligibility, error recovery, and inspector agree. Mode-specific scenario suites pass; no accidental switch from Realtime to chained for existing in-progress sessions. Native audio checks remain required for user-facing voice claims.

### Phase 6 — Preparation tools and useful progress

**Purpose:** help users bring good material to practice and choose what to improve next.

Work packages:

- P6.1 reliable preferred name, active target, company, job description, and resume upload/parse/review flow. Reuse audited existing web services; constrain files, size, ownership, errors, and privacy. Let users correct extracted facts.
- P6.2 small introduction/story library: create/type, edit, save, tag to relevant competencies, select for practice, and delete. Voice authoring can follow the already-proven adapter. Never invent candidate achievements or overwrite user facts with generated copy.
- P6.3 save/favorite questions and retry priorities; adapt existing Question Queue where useful without importing unrelated desktop complexity.
- P6.4 evidence-based recommendations with an explanation, skip/override, cold-start behavior, and bounded context. Begin with deterministic rules over reliable skill evidence rather than another AI call on every Home load.
- P6.5 progress by competency, target, and time; distinguish attempts from independent sessions, rubric versions, and guided versus unassisted work. Mark uncertain comparisons rather than manufacturing an improvement percentage.
- P6.6 assess industry-context packs after the general loop is stable; technical correctness requires vetted reference/rubric coverage. The existing spike is design input, not a finished feature to enable.

**Gate:** factual preparation material improves question relevance without cross-user context leakage; edits/deletion propagate appropriately; tests do not affect progress; recommendations link to inspectable evidence. Web fallback remains stable. No mandatory XP/quests or extra assistant port.

### Phase 7 — Economics, regression, and beta readiness

Cost instrumentation begins with Phase 1 changes, not at the end. Here, consolidate it into a credible release decision:

- Compute per-session and per-active-user costs including transcription, generation, TTS/Realtime, evaluations, corrections, failures, and retries. Mark estimated versus actual usage; prevent duplicate usage records.
- Compare transcription options on the same approved speech set for names, specialist terms, and accents. Compare voice paths using the same scenarios and defined talk ratios, not unmatched text-only figures.
- Add configurable per-session limits and server-side spend/abuse controls with clear save-and-stop behavior. Pricing/plan allowances remain a product decision after measured usage, not an unlimited voice promise.
- Re-run the full Interview and mobile gates, owner/auth/refresh tests, accessibility and recovery checks. Verify local-only dev authentication cannot activate in production configuration.
- Maintain a separate remaining-gates register for physical Android and iPhone, Bluetooth/routing, Wi-Fi/cellular transitions, accessibility, battery/thermal behavior, signed builds, privacy disclosures, account deletion/retention, sign-in requirements, store assets, and release operations.

**Gate:** repository-verified local beta candidate only. Physical-device validation, hosted backend, enrollment, signed distribution, and store/public release are separately approved phases; no automatic deployment follows this roadmap.

## 5. Test and review cadence

Per worker task: targeted deterministic tests first, then relevant typecheck/lint. No paid calls. Save exact commands, results, and known limitations.

Per integrated slice: manager inspects diff plus affected invariants, verifies worker evidence, runs cross-layer tests, and captures headless framed screens when UI changes. Run `npm run test:interview:all` before accepting a slice, not after every tiny edit. Run `npm run typecheck:mobile`, `npm run test:mobile`, mobile lint, and shared-contract checks when touched. Follow the canonical regression guide for isolated local database records and port 3210.

Before native promotion: Expo dependency/native-build checks and the explicit operator gates. Before paid model promotion: approved capped experiment plus held-out behavior/quality review. Neither can be replaced by a worker saying tests passed.

Definition of done for every work package:

- Acceptance cases met; no new unexplained regression.
- Owner/auth/idempotency and compatibility considered in proportion to risk.
- Both preview and native applicability documented; no false parity claim.
- Effective config, prompt/rubric versions, traces, and usage instrumentation updated where applicable.
- No credentials or personal test data in committed artifacts.
- Rollback path, unresolved manual gates, and concise handoff recorded.

## 6. Dependency and sequencing summary

Main sequence:

`Baseline/pilot → config/state → Coaching quality → retry/review loop → native responsiveness → lighter modes → preparation/progress → local beta decision`

Safe side lane: History pagination/status can follow the pilot while configuration/state work proceeds, if files/contracts are separate. Test-fixture authoring can run alongside implementation. Never parallelize changes to the same central turn service, auth/schema, lockfile, shared contracts, or database test fixture user.

Start with one accepted slice before increasing concurrency. At each milestone report: what works, evidence, worker/review effort where measurable, remaining risks, and next bounded assignment. Do not create ongoing automation or background worker tasks without a separate request.

## 7. Suggested first execution batch

1. Establish Phase 0 recovery point and deterministic baseline.
2. Give Luna P0.1 direct owned-review retrieval and focused tests.
3. Manager reviews/integrates and records delegation overhead.
4. Manager freezes effective-mode/state contracts and splits Phase 1 into small packets.
5. Continue one worker at a time; use Terra only where scope/repair evidence warrants it.

Stop before paid evaluation or operator audio testing, while continuing independent deterministic work where possible. No calendar estimate is asserted until baseline and the first two accepted tasks show actual throughput.

## 8. Current documentation on agent economics

Official documentation supports explicit worker-model selection and recommends Luna for narrow repeatable work, with larger models for demanding tasks: https://learn.chatgpt.com/docs/agent-configuration/subagents . This environment's collaboration API is the operative mechanism; it does not require changing global Codex configuration.

The current credit rate card lists, per million uncached input/output tokens: Luna 5/30 credits, Terra 50/300, Sol 100/500, Astra 250/1,250. These are published credit rates, not an estimate of this user's invoice or a guarantee of savings; included-plan usage, caching, reasoning, and speed settings matter. See https://learn.chatgpt.com/docs/pricing . Do not confuse these with QuesIQ's OpenAI API speech costs.

No account credits were purchased/redeemed and no global model settings were changed while writing this plan.
