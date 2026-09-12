# Interview V1 remaining gates

Updated2026-09-10. Local Phase7 preparation does not authorize any gate below.
Chained voice safeguards are implemented locally; see INTERVIEW_CHAINED_VOICE_SAFETY.md.
The execution ledger owns local acceptance. No public-release readiness claim.

The [chained voice activation proof package](INTERVIEW_CHAINED_VOICE_ACTIVATION_PROOF.md)
is complete as documentation only (2026-09-10). It specifies evidence and future
tests without closing any live gate. Provider support clarification was deferred
by the user on 2026-09-12 and is not a required next step. Independent local work
may proceed without a support response; live safeguards and paid-test gates remain.

| Gate | Status | Required evidence / next decision |
| --- | --- | --- |
| Paid AI quality | Unrun | Approve bounded budget and blinded human review across four role families/two experience levels, weak/strong/ambiguous/adversarial answers; retain held-out cases and report severe truthfulness/ownership violations |
| Real costs and allowances | Unmeasured | Approve current tariff review, caps and a small matched live sample; reconcile provider usage with billing, include failures/retries and setup/evaluation costs; set customer pricing only afterward |
| Voice cost bounds | Blocked for live activation | Explicit billing units and blocked guards are implemented; verify reliable usage/duration and speech output bounds before allowing audio dispatch; token-based text bounds do not establish audio bounds |
| Realtime termination | Blocked for live activation | Chained transcription lifecycle/cleanup is locally implemented; verify live endpoint/termination behavior and supervision surviving host failure. Full Realtime control remains separate; client timers do not satisfy this gate |
| Android physical operation | Unrun | Install an approved build on an identified device; verify microphone/speaker, Bluetooth routes, interruptions, reconnect and WiFi/cellular transitions |
| iPhone signing/installation | Unverified | Recheck Apple enrollment, provisioning and signed build/install; earlier enrollment-pending note is not current verification |
| Native durability | Unrun physically | Process-kill/reopen, disk failure and interrupted saves; verify committed text, account isolation and no automatic microphone restart |
| File preparation | Unrun physically | Picker permission/cancellation, temporary-copy cleanup and actual resume formats on Android/iPhone |
| Accessibility/input | September12 local fixes/tests accepted; physical checks open | Screen reader, focus order, dynamic text, keyboard avoidance, touch targets and device navigation across all five tabs/four modes |
| Latency/battery/thermal | Unmeasured | Identified device/OS/build/network and sample counts; first-audio P50/P95, failures/recovery, sustained usage and thermal behavior |
| Hosted backend/auth | Not activated | Approve hosting, TLS/reachability, token refresh/revocation and production configuration; loopback is not phone reachability |
| Privacy/retention/deletion | Release review pending | Review actual collection/retention, account deletion across product and usage records, backups, provider disclosure and user-facing policy URLs |
| Store/distribution | Not prepared for submission | Signed artifacts, store assets/metadata, support URLs, sign-in requirements and platform declarations reviewed against current requirements |
| Release operations | Not authorized | Reviewed commit/integration, staging migration and restore rehearsal, secrets/configuration ownership, monitoring, rollback and rollout decision |

September12 local accessibility/input review: [scope and evidence](INTERVIEW_LOCAL_ACCESSIBILITY_REVIEW_2026-09-12.md). Sign-in, microphone state and save recovery defects are fixed with deterministic coverage; this does not close physical accessibility acceptance. Accepted baseline is committed locally as ec0118c; push/integration and operational release remain separate.

## Future matched evaluation protocol

Before spending, record approved models/prompt versions, tariff dates, total budget,
sample size, operator and stop conditions. Use the same reviewed speech set for
names, specialist terms and accents, with explicit permission to use each clip.
Use matched scenarios/talk ratios for voice comparisons. Separate transcription,
generation, TTS/Realtime, corrections and evaluation; include failures and retries.
Randomize order, keep a held-out set and report sample/exclusion counts. Measure
provider usage independently of duration-based estimates. Report human usefulness,
grounding and truthfulness alongside costs and latency; do not select a cheaper
path on unmatched text-only figures. Do not promote a candidate automatically.

No new live budget, model choice, subscription allowance or rollout date is chosen
by this register. Prepare one separately scoped next gate after local handoff.
