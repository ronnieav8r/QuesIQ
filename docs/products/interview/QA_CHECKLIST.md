# QuesIQ Interview QA Checklist

Last updated: 2026-06-02

Use this checklist for V1 beta QA. Local server/browser QA may be unavailable;
when that happens, mark browser-specific checks as unavailable and continue
with production or static checks.

## Static Readiness

- Run `node scripts/interview/readiness-check.mjs`.
- Confirm result has no FAIL blockers.
- Confirm warnings are expected manual items only, such as voice hardware,
  production browser QA, or missing local env vars.
- Run `npm run smoke:interview-turns` when local Postgres is running,
  migrations are applied, and an Interview test-tunnel OpenAI key or accepted
  fallback key is configured. This model-backed smoke covers Rapid Fire,
  Intro Practice, and Story Practice/TMAAT through the backend turn engine.
- Run `npm run typecheck`.
- Run `npm run lint`.
- Run `npm run build`.

## Access And Navigation

- Signed-out visitor can reach the marketing homepage and sign in.
- Signed-in user can reach Interview from QuesIQ Home.
- Interview header shows signed-in account indicator.
- Sign In is replaced by Sign Out when authenticated.
- Admin link is visible only for admin users.
- Quira launcher is visible and does not overlap critical mobile navigation.
- Every Interview view has a path back to QuesIQ Home.
- Desktop navigation is usable and not overlapping.
- Mobile navigation shows the top four app actions and uses the hamburger/overflow
  path for the rest.

## Practice Setup

- Job target card shows the active saved target clearly.
- Target selection cards are selectable and visibly selected.
- Practice setup does not show retired First Impression as a normal Practice
  mode.
- Coaching, Rapid Fire, and Mock Interview are selectable.
- Hands-Free Coaching is visible with a Premium pill only for admins while
  `INTERVIEW_HANDS_FREE_COACHING_ENABLED` is off.
- Question focus and interviewer style selections persist into a session.
- Session preview only shows user-relevant information; admin/debug context is
  not exposed to normal users.

## Rapid Fire

- User can choose question count with the mobile-friendly stepper.
- Available count range is 1 to 10.
- Session starts hands-free after the first Que question.
- Each selected question is a separate question, not repeated follow-ups.
- Que does not ask recovery/follow-up questions in Rapid Fire unless explicitly
  designed for that mode.
- Each answer has a 65-second cap.
- 10-second answer warning appears before cutoff.
- Warning timers stop when the session ends.
- Ending the session captures pending transcript/audio state before finalizing.
- Review is generated when at least one answer was received.
- Review copy identifies Rapid Fire behavior correctly and does not rely on the
  old 120-second minimum.

## Coaching

- User can choose number of questions.
- Session starts hands-free after Que speaks.
- After a usable answer, Coaching shows More feedback, Try again, and Move on
  choices.
- Spoken choices keep listening active and route through deterministic matching
  before AI fallback.
- Que gives coaching feedback after the answer.
- More feedback gives one focused improvement and asks whether to try again or
  move on.
- Try again asks for one missing detail only.
- Move on by button and voice advances to a new question.
- Que allows at most one retry/follow-up on the same question before moving on.
- If the answer is decent, Que gives feedback and advances instead of getting
  stuck.
- Session ends clearly when the selected question count is complete.
- User receives an audible/visible end-of-session cue.
- Review is generated when at least one coached answer was received.
- Review distinguishes Coaching from Rapid Fire and Mock Interview.

## Mock Interview

- Mock Interview still uses the realtime interview simulation.
- Session starts and connects cleanly.
- Que asks realistic interview questions tied to target role/company context.
- Que maintains context across turns without exposing hidden prompt/debug text.
- End session creates transcript artifact and review path.
- Mock Interview quest/reward feels premium relative to Rapid Fire/Coaching.

## Hands-Free Coaching

- Hands-Free Coaching uses realtime voice, not the button-driven Coaching
  controls.
- Normal learners cannot launch it while
  `INTERVIEW_HANDS_FREE_COACHING_ENABLED` is off.
- Admins can launch it for QA while the flag is off.
- Signed-in learners can launch it when
  `INTERVIEW_HANDS_FREE_COACHING_ENABLED=true`.
- Que gives concise natural coaching after answers without the More feedback,
  Try again, Ask Que, or Move on menu.
- Que may ask one targeted retry/follow-up, then moves forward instead of
  looping on the same answer.
- The 15-minute cap ends the session cleanly.
- Transcript artifact, review generation, `ai_runs`, and
  `realtime_session_usage` records are saved.

## Story Lab

- Introduction Builder is in Story Lab, not normal Practice.
- User can draft/save an introduction.
- User can practice an introduction and receive review/coaching even if short.
- TMAAT story capture accepts user story in their own words.
- AI follow-up helps improve the story without inventing facts.
- Practice Story can ask alternate-spin questions from the story context.
- Saved stories and introductions appear in Story Lab history/details.
- Story Lab quests trigger for first introduction, first story, and three-story
  story bank where applicable.

## Reviews And History

- History list shows recent sessions with mode, target, focus, and date.
- Review detail opens from History.
- Admin users can see injected context/debug context where intended.
- Normal users do not see raw prompt/debug context.
- Score cards show consistent circle sizes.
- Interview home score cards keep text outside the circles and do not truncate.
- Score rings use smooth blended gradient color schemes, not solid bands.
- Review score summaries show clarity, confidence, relevance, impact, and
  authenticity with readable evidence.

## Admin Interview Panel

- Admin opens to Interview `Mode Playbooks`.
- Mode Playbooks include Rapid Fire, Coaching, Hands-Free Coaching, Mock Interview, Story Lab,
  Post-Session Review, and Voice Debrief.
- Story Lab playbook includes Introduction Builder prompts.
- Long prompt text is collapsed by default.
- Prompt Library editing still works.
- Mode/question/style component editing still works.
- Runtime & Cost contains the Interview runtime config panel.
- Rapid Fire and Coaching runtime configs show turn-based settings.
- Hands-Free Coaching runtime config shows realtime engine, coaching feedback
  depth, and a 900-second max duration.
- First-turn/kickoff instructions are visible in Admin and not hidden in code.
- Prompt Test Tunnel is available to admins in the legacy Interview Admin
  panel.
- Prompt Test Tunnel readiness shows database, OpenAI key source, active
  turn-based modes, and prompt status without exposing secret values.
- Prompt Test Tunnel can create a Coaching test session, submit typed answers,
  and send More feedback, Try again, and Move on as explicit choices.
- Prompt Test Tunnel finalized artifacts are marked as `text_simulated_voice`.

## Quira Support

- Quira opens as a messenger-style chat.
- Quick actions include practice start problems, missing review, bug report, and
  general question.
- Bug/feedback report path saves a Quira support case.
- Admin Support can view case status and conversation messages.
- Missing Quira API key returns a clear unavailable message, not a silent fail.

## Data And Production

- Production migrations are applied through latest migration.
- `DATABASE_URL` is configured on production.
- `OPENAI_INTERVIEW_API_KEY` or configured fallback is present.
- `OPENAI_INTERVIEW_TEST_TUNNEL_API_KEY` is configured on production for
  admin-only Prompt Test Tunnel QA, or an accepted Interview/OpenAI fallback key
  is intentionally used.
- Realtime API key/model/voice env vars are present for Mock Interview.
- Realtime API key/model/voice env vars are present for Hands-Free Coaching.
- `INTERVIEW_HANDS_FREE_COACHING_ENABLED` is intentionally set or unset for the
  planned learner visibility state.
- Quira key is present if testing Quira AI responses.
- Production signed-in browser QA passes on `https://quesiq.com`.
- Real microphone QA passes on at least one desktop browser and one mobile
  browser.

## Known Manual/Unavailable Items

- Local dev server QA can be marked unavailable if localhost is unreliable.
- Real microphone/realtime QA must be tested manually.
- Production signed-in browser QA must be tested manually.
- Cost/usage totals should be spot-checked after real sessions.
