# Phase 6 preparation and progress implementation contract

Approved for local implementation by the user on 2026-09-09. Scope P6.1-P6.5;
P6.6, production activation, paid provider tests and physical-device proof are excluded.
The execution ledger owns acceptance. Existing Phase4/5 dirty work is preserved.
P6.1-P6.5 accepted locally on 2026-09-09; physical/paid-quality/release gates remain open.

## Product decisions

- Five tabs: Home, Practice, Story Lab, History, Me.
- Me owns independent preferred-name edits, multiple job targets, one shared resume.
- Resume: file/paste, extract, review/edit, confirm; failed replacement preserves
  the confirmed text. PDF/DOCX/TXT/MD, 2MB, 12000 confirmed characters. No retained
  original binary, no automatic AI request. Explicit reviewed summary only.
- Story Lab: introductions and stories, manual/templates plus optional reviewed
  AI drafts. CRUD/duplicate/search/categories; original facts remain authoritative.
- Owned selected IDs resolve on the server. Up to three confirmed relevant stories
  may inform questions; setup previews context and provides an off switch.
- Introduction practice uses First Impression; story/single question uses Coaching;
  ordered sets of 1-10 questions use Rapid Fire. Legacy queue behavior stays readable.
- Persistent favorites and target/general Practice next queues are separate.
  Only a successfully saved substantive answer clears its corresponding priority.
- Home priority: learner priority, evidenced review retry, saved/under-practiced
  material, First Impression cold start. One suggestion plus two alternatives;
  explain reason and link evidence. Show another dismisses for 24h.
- Progress is evidence-first. Separate topic coverage from answer quality,
  sessions from attempts, initial/repeated/guided work. Exclude explicit test and
  uncertain legacy provenance from performance claims. Numeric trends require
  three independent comparable sessions, with mode/model/rubric/target parity.
- Deletion removes future context but preserves historical answers/reviews/copies.

## Delivery and acceptance

Implement in sequence P6.1, P6.2, P6.3, P6.4 shared evidence/recommendations,
P6.5 progress. Manager owns schema/session integration and final verification;
one bounded Luna/medium or Terra/medium worker, no recursive delegation.

Each package requires focused owner/auth/stale-edit/account-switch/failure tests,
typechecks/lint, full Interview and relevant mobile gates. Capture mirrored
headless small/large phones for changed UI; compile Android and export Hermes
at combined acceptance. Never substitute these for physical picker/audio proof.

Additive migration only, with verified local database backup before application.
Keep AI calls explicit, bounded, instrumented and duplicate-safe; tests intercept
providers. Session start and Home reads must not call summarization/evaluation.
Document remaining semantic/operator gates without reporting incomplete work accepted.

## Implemented interfaces and invariants

Versioned routes live under `/api/mobile/v1/interview`:

- `preparation` GET/PUT: optimistic profile revision, field-specific change union.
  `preparation/resume/extract` parses without saving; `resume/summary` is an
  explicit durable draft request. Confirmation/removal/summary acceptance use
  the preparation mutation contract. Extraction never retains the upload binary.
- `story-lab` GET/PUT/DELETE, `story-lab/draft` POST and `story-lab/context` GET:
  original notes, reviewed revisions, optional drafting and authoritative previews.
- `questions` GET/PUT: separate bookmarks and revisioned target/general queues;
  GET with an owned session ID exposes actual saved question text.
- `recommendations` GET/POST: deterministic suggestions and 24-hour dismissal.
  Dismiss/launch identify the feed target separately from the suggestion target:
  a general priority can appear in an active-target feed.
- `progress` GET: active/all/general/owned-target and 30/90/all filters.
- Session creation accepts selected IDs and a recommendation selection. Saved
  content is resolved from owned server rows; copied facts and client execution
  metadata are not authoritative. Legacy web saved-ID launches resolve owned
  content while retaining legacy modes and queue compatibility.
- Owned detail adds provenance, historical material status and exact supporting
  answer links. These additions do not alter existing History fields.

Migrations0089-0093 are additive: profile revision/confirmation, durable draft
requests, material revision/review/AI-assisted metadata, question bookmarks/queues,
session/evaluation provenance and recommendation dismissals. No historical rows
are backfilled as verified learner evidence. Only public learner creation marks
new sessions `learner`/version1; the admin tunnel marks `test_tunnel`; direct
internal creation defaults to `legacy_unknown`. Inspector operations stay separate.

Evidence is projected from owned completed controller transitions. A substantive
answer is at least eight words; transcript keywords and XP do not determine
provenance. One session counts once, initial answers and guided retries separately;
question repetition is matched against earlier normalized question text. A session
containing an initial answer and a guided retry still has one independent session,
but its aggregate numeric evaluation is excluded from independent comparisons.
Realtime artifacts without controller lineage can contribute an unclassified
session, never invented attempt counts or independent performance.

Qualitative evidence requires an explicit provider review with model/rubric
metadata and exact answer/question attribution. Session-level findings can be
attributed only through a stored exact quote present in the answer; generic advice
is not attributed. Heuristic evaluator fallback, synthetic evaluations and
unreviewed candidate feedback cannot establish improvement. Category tags alone
never establish competency. Numeric answer-quality detail groups mode, model,
rubric, target and assistance exactly, with at least three independent sessions
before showing chronological comparable results; no improvement percentage.

Recommendations inspect the latest20 eligible reviewed sessions within90days of
the selected target, after user priorities and before saved/coverage/cold-start
fallbacks. Dismissals never delete bookmarks or priorities. Reads and launch
resolution make no provider calls. Launch rechecks ownership, availability and
current evidence; stale IDs fail with a refresh/choose-myself path.

## Package acceptance cases

| Package | Required local proof | Separately unverified |
| --- | --- | --- |
| P6.1 | Independent name/target edits preserve resume; owned target resolution; active deletion clears selection; parser invalid/oversize/empty/PDF/DOCX cases; cancelled or failed replacement keeps confirmed text; explicit correction clears derived summary; account switch and late picker cleanup | Physical picker, native file-provider permissions, actual scanned/password-protected vendor-document sampling |
| P6.2 | Manual CRUD without a provider; stable duplicate-save replay; optimistic revision conflicts; preserved original notes/rejected drafts; reviewed owned selection; deterministic three-story limit/off toggle; deleted sources absent from new context and historical copies preserved | Paid drafting quality/human truthfulness screening, physical keyboard and assistive interaction |
| P6.3 | Persistent idempotent favorites/priority queues; max10/ownership/reorder/clear; exact single Coaching vs ordered Rapid Fire; answer1 does not mark answer2; replay/early ending keep unanswered priorities; disabled bank items cannot launch; route-return refresh | Physical session/operator flow |
| P6.4 | Priority active then general; attributable review reasons and links; cold start; 24h dismissal/replay; latest20/90day bound; new evidence refresh; stale/deleted/disabled launch failure; zero provider requests on reads | Learner usefulness screening over real preparation/history |
| P6.5 | Session deduplication; independent/assisted/repeated classification; explicit test exclusion and unknown legacy handling; exact evidence links; model/rubric/target/assistance comparisons; fewer-than-three suppression; topic/quality separation; account-scoped filters | Human calibration of provider reviews; real-device accessibility |

Focused suites: `npm run test:interview:preparation`,
`npm run test:interview:questions`, `npm run test:interview:progress`.
Combined gates: `npm run test:interview:all`, `npm run test:mobile`, root/mobile
typechecks and lint, mirrored headless screenshots, Android debug compilation
and Hermes export. The execution ledger records outcomes, corrections and logs.

One worker at a time was used: Terra/medium for initial native preparation,
Luna/medium for parser/UI and independent tests. Manager corrections own shared
schema/session/evidence decisions and final acceptance. Worker usage totals are
unavailable; no cost-savings percentage is claimed. Existing key reuse was
explicitly confirmed; no credential write or live provider request was authorized.
