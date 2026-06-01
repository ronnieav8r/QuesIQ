# QuesIQ Quira Support Chat

Quira is the QuesIQ customer support and troubleshooting assistant. V1 is built
inside the existing QuesIQ Next.js platform and starts as a signed-in app
feature, not a separate support service.

## V1 Scope

- Signed-in support chat through `POST /api/support/chat`.
- Signed-in bug/feedback report capture through `POST /api/support/report`.
- Stored support conversations, messages, tool events, curated knowledge
  articles, and support cases in Postgres.
- Admin-managed prompt key: `quira_support_chat`.
- Initial curated KB seeded for Interview practice, missing reviews, History,
  account/profile targets, and voice troubleshooting.
- Admin review API at `GET /api/admin/support` and case status updates at
  `PUT /api/admin/support`.
- Public anonymous website widget, external ticketing, Make, VAPI, Intercom,
  and Zendesk are intentionally out of V1.

## Runtime Behavior

Quira answers from the active prompt config, published Quira knowledge articles,
current product/screen context, recent conversation history, and safe session
status snapshots. It should create a support case when the user reports a bug,
blocked workflow, missing review, failed voice session, or issue that needs
human follow-up.

Safe session snapshots currently expose Interview session status fields only.
They do not expose raw transcripts by default.

The launcher flow is chat-first. Bug report capture is a secondary path from
inside the same messenger-style window. Explicit Quira bug/feedback reports are
saved to Quira conversations and support cases with product/screen/session
context, rating, browser context, and screenshot metadata.

## Admin Review

The V1 backend stores the Admin review objects needed for the Support area:

- `quira_knowledge_articles`: curated support KB, published flag, product,
  category, tags.
- `quira_conversations`: signed-in chat sessions.
- `quira_messages`: user and assistant turns.
- `quira_tool_events`: tool calls and outputs.
- `quira_support_cases`: Admin inbox items with `new`, `triage`,
  `in_progress`, and `resolved` statuses.

Admin now has practical V1 support workflow controls:

- inbox listing with status/urgency/kind/product/screen/user context
- status update controls for each case
- conversation detail view with recent stored messages

## Required Environment

- `DATABASE_URL` for storage.
- `OPENAI_QUIRA_API_KEY`, `OPENAI_SUPPORT_API_KEY`, or `OPENAI_API_KEY` for AI
  responses.
- Optional model overrides: `OPENAI_QUIRA_MODEL` or `OPENAI_SUPPORT_MODEL`.

If no support AI key is configured, the API still saves the user message and
returns a clear unavailable response instead of pretending the chat answered.

## Migration Requirement

Production must include migration `drizzle/0056_add_quira_support_chat.sql`
before Quira chat/report storage and Admin support review will function.
