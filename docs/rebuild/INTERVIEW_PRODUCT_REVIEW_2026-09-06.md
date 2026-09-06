# QuesIQ Interview product review — September 6, 2026

## Verdict and scope

QuesIQ has a substantial Interview backend and a useful native alpha. The next milestone should be a dependable, evidence-based learning loop, not more modes or another visual redesign. Keep the hybrid voice architecture: controlled turns for exercises and Realtime for realistic interviews.

This is a read-only product/architecture review, not an implementation or release approval. Reviewed the dirty `codex/interview-mobile` worktree in QuesIQ-dev, the QuesIQ-live Interview reference, the industry-context spike, active local prompt/runtime configuration, saved experiments, and fresh headless browser renders. No application code, credentials, production services, or user desktop controls were changed. Screenshots were generated in ignored artifacts. No paid model requests or audio tests were run.

Fresh checks: mobile typecheck completed; chained Coaching unit tests 7/7; Realtime model-lab unit tests 8/8. These are deterministic checks, not a fresh full regression gate or native voice certification.

## Current product boundaries

This remains one product with a shared backend, but not one shared frontend implementation:

- The Next.js web learner contains the fuller feature set, including Story Lab and progression.
- The browser mobile preview contains separately implemented design screens and a functional typed Coaching test bed.
- Expo contains the actual native screens and device/audio integrations.

The iPhone and Pixel frames mirror one test session. They are not separate product editions. However, approving a screen in these frames does not automatically change Expo. Preserve the web fallback; converge mode configuration, controllers, contracts, and portable UI deliberately rather than rewriting it wholesale.

## Rendered journey audit

Fresh screenshots are under `artifacts/review-2026-09-06/`. These are browser evidence only, not native screenshots.

| Step | Health | Evidence and interpretation |
| --- | --- | --- |
| 1. Open local test bed | Needs attention | A fresh unauthenticated context displayed admin-access errors; opening the local root first established development authentication. Make the local setup requirement explicit rather than leaving an opaque error. |
| 2. Inspect framed no-audio Coaching | Good developer foundation | `03-testbed-auth.png`: coherent graphite/cyan/lime styling, mirrored phones, developer controls outside the frames. It is a diagnostic workspace, not yet evidence of the whole customer journey. |
| 3. Inspect Practice design | Good direction; parity incomplete | `07-practice-full.png`: strong question-first hierarchy, prominent answer action, restrained navigation. Role, question, and progress values here are visual-preview data. Native Practice remains a separate four-section form. |
| 4. Inspect existing web Home | Functional but busy | `02-web-home.png`: target setup, reviews, memory, XP, and quests compete for attention. Port the next useful action, not every dashboard widget. |
| 5. Inspect existing Story Lab | Valuable feature to adapt | `06-story-lab.png`: introduction/story building, voice/dictation/text options, and saved library concepts. Convert the useful pieces into short phone workflows rather than copying the desktop layout. |

The element captures `04-practice-design.png` and `05-review-design.png` are not relied upon for layout findings; the Practice view was recaptured full-page to avoid sticky-toolbar interference. Native typography, keyboard behavior, accessibility scaling, and audio states were not visually revalidated in this review.

## Priority findings

### 1. Actual mode routing and displayed configuration disagree

`apps/mobile/src/app/session.tsx:98` selects ChainedCoachingSession only for Coaching; the other modes use NativeVoiceSession. Native Rapid Fire is therefore still Realtime, despite the intended controlled workflow.

`src/server/interview/chained-coaching-service.ts:18` overrides enabled status, engine, text model, transcription model, TTS model, and voice. The active local runtime/inspector showed Coaching as GPT-5.4/Alloy while the chained service forces GPT-5.4 Mini, gpt-live-transcribe, and gpt-4o-mini-tts/Marin. Native Practice also hardcodes its mode list instead of taking availability from the catalog.

Create one effective, versioned mode configuration consumed by native routing, backend requests, and the inspector. Show configured values and effective overrides explicitly until overrides are removed. Add an integration assertion that the displayed model/engine equals the one actually requested.

### 2. Prompt layers contain conflicting behavioral rules

The active Coaching mode instructions allow an immediate follow-up or retry after feedback. The active responder instead requires a choice menu and forbids a new question at that point. The responder asks for a retry focused on a missing element, while the task instruction says to preserve the original question exactly. Question-focus instructions can also encourage multiple follow-ups while another layer requires one question.

The turn runtime combines planner and responder instructions, mode/focus/style instructions, task instructions, context, and an output contract. This makes the problem larger than a model simply refusing instructions.

Define the behavior once in application state: current question ID/text, primary-question count, attempt number, and allowed actions. Use small operation-specific prompts. The model should draft the next permitted artifact, not decide whether the UI advanced. Count primary questions separately from retries and feedback operations; the current turn-index limit can include those extra operations.

### 3. Validation guarantees format better than useful coaching

`src/server/interview/turn-based.ts` repairs long replies, detects a narrow set of role reversals, and uses keywords to decide whether feedback is actionable. Repairs can replace specific feedback with a generic instruction. The validator returns `passed: true` after repair.

Keep repair telemetry, but distinguish raw schema validity, behavioral validity, repair/rejection rate, and delivered semantic quality. A response containing the word "specific" is not necessarily specific to the answer. Evaluate whether feedback quotes or accurately refers to actual user evidence, identifies one worthwhile improvement, and avoids inventing experience or results.

### 4. Chained speech boundaries and latency need a focused slice

The transcription route uses server VAD with a 650 ms silence interval. Native Coaching submits a completed transcription event and disables the microphone immediately. A pause while thinking can therefore be treated as a finished answer. This is a code-derived risk, not a newly reproduced audio failure.

For deliberate practice, make "Done answering" the authoritative default and accumulate transcript segments until submission. Offer automatic turn completion later with clear feedback and a recovery path. Keep listening, processing, speaking, and choice states unmistakable. Preserve a text-only fallback.

TTS currently waits for the complete MP3 response, packages it as base64, and only then delivers it for playback. Validate a complete structured response first, then stream approved speech where the native player supports it. Do not stream unchecked coaching tokens. Separate spoken feedback from on-screen choice labels; repeatedly reading the whole menu increases latency and cost. Measure transcription-final, model, validation, TTS-first-byte, and player-start times separately.

### 5. History and review retrieval will fail to scale

Native History/Review depend on bootstrap's latest 50 sessions. Review searches that collection rather than fetching its ID directly. Even the current detail route searches only the latest 100 sessions. Older records can become inaccessible through these paths without being deleted from Postgres.

Use lightweight paginated History summaries and a direct owned-session lookup. Poll pending evaluations, expose retry for failed evaluations, and implement the pull-to-refresh behavior the current review copy promises. Keep eligibility text consistent with the shared eligibility rules rather than hardcoded two-minute wording.

### 6. Feedback needs to become an improvement loop

The backend already stores richer evidence and next-step fields than the native dimension cards expose. Make the primary review path:

`Answer → evidence-backed feedback → retry the same question → compare attempts → select the next targeted exercise`.

Show one priority improvement before a long scorecard. Pair it with a transcript excerpt and a concrete revision goal. Avoid presenting transcript-only scoring as measurement of vocal tone, emotional state, honesty, or hiring likelihood. Distinguish insufficient evidence from a low score. Keep question, rubric, prompt, and model versions with scores, and separate guided retry scores from unassisted mock performance.

## What the saved experiments show

The August 27 lighter-mode optimization summary reports two successful runs out of three for each mode in the repeated set, with remaining role reversals and Rapid Fire drift. Some isolated runs passed; stability across repetitions did not. This supports moving structured control into code rather than indefinitely increasing prompt complexity.

The August 27 chained comparison reports:

| Measure | Chained Coaching | Realtime Mini |
| --- | --- | --- |
| Behavioral turns in this small fixture | 4/4 | 4/4 |
| Average first audio | 4,253 ms | 841 ms |
| Estimated exchange cost | $0.034685 | $0.038394 |
| Estimated cost/conversation minute | $0.0304 | $0.0263 |
| Chained corrections | 2 of 4 | Not an equivalent repair measure |

Do not promote these numbers to a production cost or quality claim. The chain waits for a full file whereas Realtime is measured at its first audio event; answers and estimated durations differ; input speech is projected; human naturalness and actual recognition accuracy are unverified. End-of-session evaluation and broader operating costs also need accounting. In the chained cost breakdown, projected TTS is the largest component, not text reasoning.

The formal native proof artifact inspected is incomplete and predates the user's later report that host-microphone access fixed capture. It is not evidence that capture is still broken. A fresh two-sided transcript/evaluation/reopen certification remains an acceptance task when audio testing is possible.

## Recommended architecture and mode design

| Mode | Recommended experience | Voice path |
| --- | --- | --- |
| First Impression | One opening answer, focused critique, optional retry | Chained |
| Coaching | One question, answer, one improvement, explicit choice | Chained |
| Rapid Fire | Short question/answer sequence; brief or batched feedback | Chained with deterministic advancement |
| Mock Interview | Natural interview with follow-ups; defer coaching until the end | Realtime |

This matches OpenAI's distinction between natural speech-to-speech and predictable controlled workflows: [voice-agent guidance](https://developers.openai.com/api/docs/guides/voice-agents).

Keep a provider-neutral boundary for transcript events, generated turns, synthesis, and usage, but do not start a provider migration before fixing internal routing and prompt conflicts. The current transcription choice also deserves an A/B test: official pricing lists gpt-live-transcribe at $0.017/audio minute versus gpt-4o-mini-transcribe at $0.003. Lower price is not proof of adequate accuracy for names, accents, or specialist language. [Current pricing](https://developers.openai.com/api/docs/pricing).

The Speech API supports streamed audio output; integrating that safely with the native player is a separate implementation/test task. [TTS guidance](https://developers.openai.com/api/docs/guides/text-to-speech).

For commercial budgeting, report cost per completed session, per active minute, and per active user, with modality usage, evaluation, retries, and provider failures included. Test different user/Que talk ratios and repeated-session retention assumptions before setting plan allowances. Avoid unlimited expensive voice at launch until usage is understood.

## Prompt and evaluation program

1. Write plain-language behavior examples for each mode, including clarifying questions, silence, partial transcripts, retries, and stopping.
2. Remove contradictory prompt layers and place navigation/state changes in code.
3. Give each model operation the smallest relevant context: current target, relevant resume/story facts, current question, answer, and bounded prior turns. Do not resend the entire story library and all performance history by default.
4. Use separate rubric emphasis for behavioral, motivational, situational, and technical answers. Do not impose STAR mechanically on every question.
5. Require answer-grounded feedback, no invented metrics, and one priority improvement. Evaluate the current answer before applying historical trend context to reduce anchoring.
6. Expand beyond the current small fixtures: multiple professions, seniority levels, answer lengths, strong/weak/unusual answers, interruptions, names, accents in the later audio set, prompt-injection attempts, and ambiguous requests.
7. Record raw/delivered outputs, corrections, versions, stage timings, usage, and human ratings. Reserve held-out cases and repeat runs. Use automated scoring as a screen, not the sole authority.

## Development order

### Slice 1 — Trustworthy Coaching loop, no audio required initially

Unify effective configuration; resolve prompts; model the question/attempt state explicitly; improve semantic evaluation; fix History/detail loading and review retry; add evidence and retry comparison to the framed test bed and actual Expo implementation.

Acceptance: a typed answer can be coached, retried, compared, persisted, and reopened; the inspector accurately identifies the executed configuration; critical role/state violations fail rather than being hidden by a generic repair. Keep all tests out of learner progress and memory.

### Slice 2 — Native UX and latency

Bring the approved design into Expo. Implement answer-completion control, stage telemetry, validated TTS streaming if supported, and interruption/recovery checks. Re-run native certification and user listening tests when available. Preserve the silent test bed as the default developer workspace.

### Slice 3 — Port high-value preparation features

Prioritize role/job-description/resume onboarding and a small introduction/story bank. Let users supply factual stories, connect them to question types, and practice retrieving/adapting them without inventing details. Then add saved questions, focused practice recommendations, and progress by skill. The industry-context spike is useful design groundwork, not proof of a completed runtime feature.

### Slice 4 — Expand modes and beta gates

Move Rapid Fire onto the controlled engine, simplify First Impression, and validate Mock Interview as the realistic assessment mode. Require full regression, cross-user access tests, native proof, physical-device audio/accessibility checks, privacy/account deletion, and store readiness separately before release. Do not port all quests, XP, extra assistants, or admin complexity simply because they exist on web.

## Evidence locations

- `apps/mobile/src/app/session.tsx`
- `apps/mobile/src/app/(tabs)/practice.tsx`
- `apps/mobile/src/components/interview/chained-coaching-session.tsx`
- `apps/mobile/src/app/(tabs)/history.tsx`
- `apps/mobile/src/app/review/[sessionId].tsx`
- `src/server/interview/chained-coaching-service.ts`
- `src/server/interview/turn-based.ts`
- `src/app/api/mobile/v1/interview/bootstrap/route.ts`
- `src/app/api/mobile/v1/interview/sessions/[sessionId]/detail/route.ts`
- `src/product/review-eligibility.ts`
- `artifacts/interview-realtime-model-lab/2026-08-27-mini-lighter-optimization-summary.md`
- `artifacts/interview-chained-coaching/2026-08-27T14-42-57.167Z-comparison.md`
- `artifacts/mobile-native-proof/`
- `artifacts/review-2026-09-06/`

Bottom line: build a coach that can demonstrate why an answer improved. The present foundation can support that; more features and more elaborate prompts are not the limiting factors right now.
