# Rebuild Plan

## Goal

Replace the Bubble-hosted QuesIQ Interview beta with a custom coded app that we
own end to end, while continuing to use external services where they buy speed
and quality.

The immediate product target is not "feature parity at any cost." It is a
better beta:

- Faster path from signup to a useful first voice practice session
- Clearer mobile UI and session setup
- Reliable session, transcript, evaluation, and progress data
- Easier iteration than Bubble for UI, workflows, tests, and integrations

## Product Thesis

QuesIQ Interview helps job seekers practice interviews out loud with an AI coach
and turn each practice session into useful feedback and a better next session.

Voice practice is the differentiator. Progression should support the practice
habit, not obscure the product promise.

## Rebuild Principles

1. Own the app logic.
   Core users, sessions, evaluations, stories, recommendations, and progression
   belong in our code and database.

2. Use direct OpenAI Realtime first for browser voice.
   The first coded voice path should stay server-mediated and app-owned. Keep
   VAPI as fallback if direct voice testing reveals a material beta blocker.

3. Keep Make for automation edges.
   Email, Brevo, beta operations, and external workflow glue can stay in Make.
   The interview loop should not depend on Make for every core state change.

4. Build mobile-first without trapping desktop.
   The beta can prioritize mobile, but desktop should be intentionally usable.

5. Preserve valuable product learning from Bubble.
   Reuse the proven modes, scoring dimensions, prompts, and progression ideas.
   Rework confusing screens and overbuilt flow steps.

6. Build thin vertical slices.
   Each milestone should leave a runnable app that proves the next risk.

## Recommended Stack

### App

- Frontend and backend: Next.js with TypeScript
- UI: React components with a small app-specific design system
- Styling: Tailwind CSS or CSS modules chosen during scaffold setup
- Validation: Zod
- Forms: React Hook Form if forms become complex

### Data And Auth

- Database: Postgres
- ORM/migrations: Prisma or Drizzle selected during scaffold setup
- Auth: Auth.js, Clerk, Supabase Auth, or another chosen provider after the
  first auth decision
- File storage: object storage for resumes and optional recordings/artifacts

### AI And Voice

- Voice runtime: direct OpenAI Realtime browser voice session, server-mediated by this app
- Interview coach: Que assistant configuration built per session
- Evaluation: backend AI call after completed practice session
- Text support chatbot: Quira remains separate unless we deliberately merge it

### Delivery

- Source control: GitHub
- Hosting: Render is the default deployment target for now
- Automation edges: Make and Brevo where they already fit
- Observability: structured server logs, error reporting, AI/voice cost logging

## Milestones

### Milestone 0: Blueprint And Scaffold

Deliverables:

- Rebuild folder and plan
- New code repository or clearly separated app root
- Environment variable inventory
- Initial CI/test commands
- Render deployment shape

Exit test:

- A new app can run locally and deploy a health-checked preview.

### Milestone 1: App Shell And Auth

Deliverables:

- Mobile-first signed-out and signed-in shells
- Signup/login/account recovery strategy
- Protected app routes
- Navigation structure for Home, Practice, Stories, Me
- Base design tokens and reusable controls

Exit test:

- A user can create an account, sign in, and land in an empty but coherent app.

### Milestone 2: Onboarding And Interview Context

Deliverables:

- Preferred name
- Target role and company
- Optional industry/context fields
- Resume upload path
- Job description capture
- Clear "start now" path even when optional context is missing

Exit test:

- A new user can give enough context to launch a personalized first session.

### Milestone 3: Practice Setup Flow

Deliverables:

- Mode picker
- Question type selection for drilling modes
- Interview style selection
- Confirmation/readiness screen
- Session record creation before voice launch

Exit test:

- Each practice mode routes through only the required setup steps and creates a
  session with a reproducible config snapshot.

### Milestone 4: Voice Session Slice

Deliverables:

- Direct OpenAI Realtime session page
- Que dynamic assistant config path
- Microphone permission/readiness handling
- Speaking/listening/ended UI states
- Transcript and call lifecycle handling
- Session artifact/event capture path for end-of-call handling

Exit test:

- A user can complete a browser voice practice session and our database receives
  enough session artifact data to evaluate it.

### Milestone 5: Evaluation And Session Review

Deliverables:

- Evaluation prompt/service
- Five score dimensions
- Session review screen
- Coaching insight
- Recommended next action/mode
- Basic session history

Exit test:

- A completed session produces a user-facing review and can be revisited later.

### Milestone 6: Progression And Retention

Deliverables:

- XP and levels
- Streaks
- Rolling stat summaries
- Quests/milestones
- Dashboard Up Next logic
- Better empty states and first-session guidance

Exit test:

- The dashboard changes meaningfully after practice and gives a sensible next
  action.

### Milestone 7: Stories And Job Targets

Deliverables:

- Story library
- Story editing/practice hooks
- Saved job targets
- Use job context in setup where it reduces friction

Exit test:

- Users can prepare reusable interview stories and practice against saved job
  context.

### Milestone 8: Beta Hardening And Cutover

Deliverables:

- Accessibility pass
- Mobile and desktop QA
- Security/privacy review
- Prompt/config versioning review
- Cost and failure monitoring
- Migration/cutover decision for Bubble users and data

Exit test:

- We can invite real beta users to the coded app with a rollback plan.

## First Build Slice

The first implementation slice should be small and real:

1. Scaffold the custom app.
2. Add app shell and navigation.
3. Define the initial Postgres schema for User/Profile, PracticeMode,
   QuestionType, InterviewStyle, Session, and Evaluation.
4. Seed the four practice modes, four question types, three interview styles,
   and level thresholds.
5. Build onboarding and the practice setup flow without voice first.

That slice proves navigation, data ownership, and the session setup model before
we spend time integrating live voice.

## Reference Inputs

Use these as reference, not as constraints:

- `../claude_handoffs/interview_prep_app_project_state (4).md`
- `../codex_context_pack/01_PROJECT_CONTEXT.md`
- `../codex_context_pack/02_ARCHITECTURE.md`
- `../docs/QUESIQ_INTERVIEW_PRODUCT_BRIEF.md`
- The live Bubble beta on `app.quesiq.com`

## Success Criteria For The Rebuild

- The app can be developed and tested without Bubble.
- Users can reach a voice practice session faster and with more confidence.
- Session outcomes are stored and explainable in our own database.
- The UI has a cleaner foundation for product iteration.
- External services are replaceable at clear boundaries.
