# Phase 3 implementation contract

User directed proceeding to Phase3 on 2026-09-06. Phase2 paid quality work is
deferred, not accepted or promoted. Keep current learner prompts and engine
choices; candidate evidence remains explicitly unreviewed/inspection-only.

## Frozen interfaces

- GET `/api/mobile/v1/interview/sessions?limit=20&cursor=...` returns
  `{sessions:SessionHistorySummary[],nextCursor:string|null}`. No transcript,
  full evaluation, resume/snapshot, or per-answer query in the list. Default20,
  max50, malformed cursor/limit400. Order createdAt DESC, ID DESC; cursor retains
  Postgres microseconds. Every page filters by owner and supported mobile modes.
  Existing web `/api/sessions` and bootstrap contracts remain unchanged.
- Existing owned detail URL returns `{session:SessionDetail}`; old fields remain,
  adding server `reviewAccess` and `attempts`. Fetch byID, never recent bootstrap.
- `reviewAccess` is kind, message, canRequest. Only eligible permits a deliberate
  POST. Existing completed, processing, insufficient-content/too-short, missing
  artifacts and uncertain provider outcomes cannot be retried from Review.
  Failed with a confirmed rejected request can be offered explicit retry.
  A failed/completed status with no explanatory ledger/review is uncertain;
  absence of a ledger is not proof that no provider attempt occurred. No lease expiry
  starts another provider request; polling is read-only and bounded/backed off.
- Review POST uses `{confirmRetry:true}` for deliberate failed-review retry;
  normal existing first-evaluation paths remain compatible. Provider timeout or
  post-response persistence failure is uncertain, never permission to rebill.
- `attempts` derives from completed owned operation rows. Answer turns only,
  not choices or clarification. Question/attempt IDs use structured controller
  state; do not guess from assistant prose. Preserve exact text and any validated
  evidence, model/prompt versions. Label retries assisted; never compute score
  gains across these guided attempts. Legacy data lacking provenance stays empty.
  Existing JSON operation records persist relationships; no migration needed.

## Client behavior / scope

Native History uses user-scoped infinite query keys, real RefreshControl,
load-more and explicit errors. Review uses user+ID keys, direct read and bounded
polling; never evaluation mutation from effects. A failed mutation refetches
status before another offer. Stop polling on terminal/error states and pause
when app is not active. Preserve auth refresh, no cross-account cached data.

Show existing next action and evidence before scorecard. Only link an exact
excerpt to the matching transcript turn; otherwise label evidence as unlinked.
Show same-question first/latest attempts together, truthful assisted labels and
versions. Native active Coaching already offers same-question retry; inspect
and persist its attempt provenance. Inspector has the same derived comparison
without creating learner History/progress. Browser review work stays inside
the shared mirrored frames; default remains silent Coaching Simulation.

## Gates

Local synthetic owner/stranger data only; block outbound fetch. Prove pagination
past150 rows, equal timestamps/microseconds, no duplicate/omitted IDs, foreign
cursor isolation, invalid inputs, direct detail and no heavy list fields.
Prove read-only poll, explicit confirmed retry, processing/uncertain rejection,
repeated request safety, too-short eligibility, legacy detail, persisted attempt
comparison/reopen, and no inspection-to-learner leakage. Native component tests
and framed headless screens required; no real audio/paid calls/deployment.

## Expo parity checklist and evidence limits

| Behavior | Framed browser | Expo source/component evidence |
| --- | --- | --- |
| Older History and owned detail | Saved reviews tab; desktop/mobile headless pass | Direct URL, encoded cursor, user-scoped cache and load-more error hook tests |
| Status recovery | Read-only poll, explicit two-click request, failed refresh blocking | Six automatic checks maximum, background/foreground/error tests, real RefreshControl |
| Retry safety | Deliberate confirmation only; no automatic POST | Duplicate mutation lock through status refresh, unknown-result suppression and cross-account tests |
| Evidence and priority | Exact excerpt highlights transcript before scorecard | Existing next action/evidence precede scorecard; press opens highlighted transcript |
| Attempt comparison | Typed Simulation answer/retry/comparison/export/reload pass | Native comparison includes first/latest text, feedback, evidence, priority and versions; shared structured projection/service persistence tests |
| Inspection isolation | Test runs remain separate from learner sessions | Synthetic owner/stranger API/service tests; no test rows in the user's account |

This is layered automated evidence, not a single native-device end-to-end run.
Native microphone/player, physical scrolling/keyboard, compilation and app-restart
operator proof are not newly certified by Phase3. Preserve the existing native
proof gates and perform Phase4's build/recovery work before making device claims.

To review locally, open `/interview/mobile-preview` and choose **Saved reviews**.
For typed comparison, remain in default **Test Coaching · no audio**, answer,
choose **Try again**, submit the second answer, then choose **Compare attempts**.
Both frames share state; developer traces and exports stay outside. Empty learner
History is valid; simulation tests do not create artificial learner progress.
