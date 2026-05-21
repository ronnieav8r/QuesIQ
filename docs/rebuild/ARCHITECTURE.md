# Architecture

## High-Level System

```mermaid
flowchart LR
    U["User Browser"] --> A["QuesIQ Interview Web App"]
    A --> B["App Backend"]
    B --> D["Postgres"]
    B --> F["File/Object Storage"]
    A --> V["VAPI Web Voice Runtime"]
    V --> W["VAPI Webhooks"]
    W --> B
    B --> E["Evaluation Model API"]
    B --> M["Make Automation Edges"]
    M --> R["Brevo / Other External Tools"]
```

## Ownership Boundaries

### Our App Owns

- Authentication integration and authorization rules
- User/profile/interview context
- Practice setup flow
- Session records and context snapshots
- Evaluation pipeline
- Progression data
- Stories, job targets, history, settings
- UI design and analytics events

### VAPI Owns In The First Beta

- Browser live voice call runtime
- Speech/audio session orchestration
- Turn-taking behavior provided by its voice stack
- Call events and voice artifacts exposed through SDK/webhooks

### Make Owns Only Edges

- Email/contact automation where useful
- Beta feedback and operational workflows
- Existing integrations that are cheaper to keep than to rebuild immediately

## Route Shape

Proposed app routes:

- `/`
- `/login`
- `/signup`
- `/onboarding`
- `/app`
- `/app/practice`
- `/app/practice/session/[sessionId]`
- `/app/sessions/[sessionId]/review`
- `/app/history`
- `/app/stories`
- `/app/me`

Route names can change during implementation. The key decision is that practice
setup and voice session ownership are explicit in the coded app.

## Initial Domain Model

### User/Profile

- id
- auth identity
- email
- display name
- preferred name
- onboarding state
- current target role/company/industry
- current job description
- context summary
- XP, level, streak fields
- rolling stat fields or derived stat summaries

### ResumeAsset

- id
- user id
- storage key/url
- parse status
- extracted text
- derived context metadata

### PracticeMode

- key
- display name
- description
- prompt/config fields
- first message template
- max token/session settings
- setup behavior flags
- active/sort order

### QuestionType

- key
- display name
- guidance
- sort order

### InterviewStyle

- key
- display name
- guidance
- sort order

### Session

- id
- user id
- mode
- selected question type
- selected interview style
- context snapshot
- status
- start/end times
- VAPI call id
- transcript artifact
- evaluation status
- user-facing session metadata

### Evaluation

- session id
- five scores
- coaching insight
- feedback/review body
- suggested next mode/action
- raw structured model output
- prompt/config version

### Story

- user id
- trait
- situation
- task
- action
- result
- reflection
- coach notes
- version and practice timestamps

### Progression

- LevelThreshold
- Quest
- UserQuest
- Progress events or enough event data to recompute important state

## Session Lifecycle

1. User completes practice setup.
2. Backend creates a Session with an immutable launch snapshot.
3. Backend produces or authorizes the VAPI call configuration.
4. Browser launches the VAPI session.
5. Frontend shows live session state and graceful end controls.
6. VAPI sends lifecycle/end artifacts to backend.
7. Backend stores transcript/call references.
8. Backend runs evaluation.
9. Backend updates session review and progression.
10. User lands on review and dashboard reflects the result.

## VAPI Integration Direction

Use VAPI directly from the custom app through its web integration, backed by our
server for sensitive configuration and webhook handling.

The app should avoid exposing:

- private VAPI keys
- raw backend provider keys
- sensitive prompt templates when a server-mediated design is practical
- user context beyond what the session requires

The first VAPI implementation should support:

- dynamic per-session Que prompt/context
- four practice modes
- call ID correlation to our Session record
- end-of-call processing
- transcript artifact storage
- recoverable failure states when a call fails or evaluation fails

## Evaluation Direction

Evaluation should be a backend service after the practice session. Store:

- model/provider used
- prompt/config version
- structured evaluation output
- user-facing review text
- progression updates derived from the result

This keeps reviews auditable and lets us improve evaluation prompts over time.

## Deployment Shape

Initial likely deployment:

- Render web service for the app/backend
- Managed Postgres
- Managed object storage
- GitHub-driven deploys

The exact hosting split can change if Next.js deployment needs a different shape,
but the rebuild should keep secrets server-side and maintain preview/local parity.
