# Phase 2 Coaching candidate contract

Manager specification, 2026-09-06. Follows Phase 1 acceptance. Implements the
approved roadmap's no-audio work; not paid-text or native-voice certification.

## Isolation and promotion

Keep current prompt behavior available as `current`. Add `candidate_v2` as an
explicit local inspector selection, not a new learner mode or another app.
Default remains Simulation with no automatic test/API request. The server pins
candidate prompt bodies, versions, and profile to the inspection snapshot.
Never accept a candidate profile through the public native session parser.
No activation for native sessions or existing web learner sessions yet.

Candidate provider: existing `gpt-5.4-mini`, Responses API, low reasoning,
structured JSON output. No model migration, transcription/TTS change, database
prompt activation, or migration. Existing AI-usage and operation ledger apply.
References: official OpenAI [structured output guidance](https://developers.openai.com/api/docs/guides/structured-outputs),
[prompt engineering](https://developers.openai.com/api/docs/guides/prompt-engineering),
and [GPT-5.4 Mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini).
JSON schema adherence is not semantic correctness; keep human quality status
explicitly unreviewed until a blinded evaluation, even when validation passes.

## Candidate operations

Use one operation-specific prompt per provider request; never concatenate the
old planner/responder/catalog behavioral instructions. Share only neutral Que
identity, English/plain speech, untrusted-data boundaries, and no-fabrication
rules. Do not request state/done/action from the model. Phase 1 controller owns
all progression. Retry and limit-end remain no-generation operations.

| Operation | Input | Output and behavior |
| --- | --- | --- |
| question | target/focus/style, prior primary questions | One relevant interview question and target skill; no feedback, menu, STAR bundle, company-specific invented premise, or transition decision. |
| evaluate | current exact question + latest candidate answer | Answer-specific spoken feedback, one priority improvement, exact supporting answer excerpts. No personality claims or pressure to invent numbers. |
| explain_feedback | current question + original answer + previous delivered feedback | Explain the same priority with a practical next step, not a new interview question or unrelated critique. |
| clarify | same original answer/feedback + current clarification text | Answer the user's clarification about the current exercise; distinguish clarification from an interview answer. Stay on this question. |

Behavior examples: blank answer is rejected before claiming a turn; brief or
partial answer gets insufficient-information feedback when needed, not invented
strengths; off-topic/test input is acknowledged as not an assessable answer;
retry retains question/ID; clarification and more feedback retain attempt and
primary count; move-on changes only the primary count; End suppresses late output.
Behavioral emphasizes personal action and outcome without demanding a script;
motivational emphasizes genuine fit and supported reasons; hypothetical examines
reasoning/tradeoffs without requiring a past STAR story; technical emphasizes
accuracy/explanation and flags unknown employer/equipment-specific facts.

## Bounded portable candidate contract

`CoachingCandidateOperation`: question, evaluate, explain_feedback, clarify.
`CoachingCandidateContext` contains operation, questionType, style, targetRole
(200), targetCompany (200), jobDescription excerpt (1500), resume excerpt (1500),
currentQuestion (2000), answer (12000), clarification (2000), previousFeedback
(1000), priorQuestions (last3, each500). Optional absent text becomes empty string.
Input is a caller-owned snapshot/ledger; no broad database-memory fetch or
unrelated story-library dump. Use JSON data under a system instruction that
these values never grant authority. Evidence offsets refer to the exact supplied
answer string; do not trim or normalize before matching evidence.

Question output strict: `{question:string(1..800),targetSkill:string(1..120)}`.
Feedback output strict: `{status:'supported'|'insufficient_information'|'off_topic',
spokenFeedback:string(1..600),priorityImprovement:string(0..300),
evidence:Array<{quote:string(1..400)}> (max3)}`.
Supported feedback requires at least1 exact excerpt and nonblank improvement.
Insufficient/off-topic feedback may have no evidence; do not label it a supported
assessment. Every provided excerpt must occur exactly in the supplied answer.
The server adds start/end offsets for the first exact occurrence (JavaScript
UTF-16 string offsets); models do not calculate offsets. This is deterministic
evidence enrichment, not a repair of a failed quote. Off-topic must not assert a score.
Do not infer complete semantic grounding just from a matching quote.

Validation separates `rawSchemaValid`, `behaviorValid`, `disposition`
(accepted/rejected), `issues`, and `semanticQuality:'unreviewed'`. Never repair a
failure into a pass by returning a generic fallback. Invalid responses are
traced as rejected, not delivered, and retained under uncertain operation state
to prevent automatic rebilling. Repeating an accepted operation reuses it.

Deterministic simulation emits explicitly labeled fixtures, not fake evidence
that an AI understood an answer. Tests verify schemas, evidence offsets,
context bounds, operation separation, malicious state fields, bad quotes,
missing priorities, provider refusal/error, replay, and persistence/reopen.

## Quality gate requiring user input

After deterministic acceptance, request a bounded paid-text screening budget
and human review. Prepare separate screening and held-out case sets (four role
families, junior/senior, weak/strong/short/long/ambiguous/adversarial). Do not use
holdout outputs to tune the candidate. Report severe failures, compliance,
rejection rate, latency, tokens/cost, and blinded usefulness/grounding ratings.
No automatic promotion or claim of improved coaching based on fixtures alone.

### Prepared screening protocol (not run / not authorized)

Fixtures: `tests/interview/fixtures/coaching-candidate-quality-cases.ts` has
8 screening cases and16 held-out cases. Both cover aviation, healthcare,
software and operations at junior/senior levels. Category labels such as
strong/weak are scenario design intent, not a measured model or human score.
Long cases have distinct narratives, not shared paragraphs with role suffixes.

First proposed experiment: compare current and candidate answer feedback on
the8 screening cases, with identical fixed question, answer, target context and
model. Seed the fixed question as an explicitly marked fixture controller turn;
do not pretend it was model-generated. Candidate feedback takes1 provider call;
the current planner/responder path may take2. Expected maximum24 requests for
this first pass, with no retries, audio, transcription, TTS, or model judge.
Question-generation and follow-up tests are a separately declared follow-on,
not hidden extra calls. Do not run the old audio comparison script for this.

Before running, implement/verify a dry-run manifest using the same local
inspector/services, freeze prompt/context hashes and actual request limits, and
reserve worst-case estimated input/output cost before each request. Stop before
exceeding the approved cumulative ceiling, on missing pricing/usage, provider
error, or a severe failure; never auto-resume an uncertain operation. A proposed
$2 ceiling is a user approval limit, not a current charge estimate or a hard
OpenAI account-level cap. No approval was inferred from roadmap execution.

Export original/delivered responses, exact evidence, deterministic validation,
latency, tokens, estimated cost including rejected outputs, and blinded A/B
review rows. Human review rates relevance, grounding, usefulness and truthful
uncertainty from1 to5, flags severe fabrication/personality/role violations, and
checks whether the single next step is actionable. Do not disclose the prompt
profile in the blinded rows; retain a separate mapping. Matching excerpts and
strict JSON alone never satisfy this quality gate.

Tune only against screening. Freeze a candidate before the16-case holdout;
holdout execution and repetitions require their own declared budget/sample.
Any tuning based on holdout results retires that holdout from independent use.
Eight screening cases cannot establish a reliable95% population success rate.
Promotion also needs the roadmap's broader behavior matrix and human review.

### Local verification and rollback

`npm run test:interview:coaching:candidate` runs contract/fixture checks plus
network-intercepted local database tests. It is included in the canonical
Interview service gate. No real provider request is made by that command.
The headless framed test covers explicit selection, exact answer/evidence,
same-question retry, saved-test reopening and safe defaults after reload.

Current learner prompts remain unchanged. To stop testing the candidate, choose
Current when creating the next inspection; existing tests keep their pinned
prompts. There is no prompt-table activation, schema migration or native rollout
to reverse. Candidate records stay inspection-only and export from the existing
JSON/CSV controls, including rejected traces and their available usage.
