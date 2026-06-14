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
- Quira is visible on the public marketing page with limited public AI chat for
  general brand, product, beta, signup, and routing questions.
- Public visitors cannot access account, billing, profile, or session-specific
  troubleshooting context. Quira routes those requests to sign-in.
- Public and signed-in chats can create Quira leads for signup, beta access,
  pricing, product-fit, or human follow-up requests.
- External ticketing, Make, VAPI, Intercom, and Zendesk remain out of V1.

## Runtime Behavior

Quira answers from the active prompt config, published Quira knowledge articles,
optional OpenAI file-search results, current product/screen context, recent
conversation history, and safe signed-in session status snapshots. It should
create a support case when the user reports a bug, blocked workflow, missing
review, failed voice session, or issue that needs human follow-up.

Quira should sound professional and customer-facing. When a user is blocked,
frustrated, or reporting trouble using the site, she should briefly acknowledge
the problem and apologize without sounding patronizing, then move directly to a
useful next step or the right support action.

Safe session snapshots currently expose Interview session status fields only
for signed-in users. They do not expose raw transcripts by default.

Postgres remains the source of truth for Quira knowledge. Published curated
articles can optionally sync to an OpenAI vector store so Responses API file
search can retrieve broader context during a chat response. When no vector store
is configured, Quira falls back to curated Postgres knowledge search.

The launcher flow is chat-first. Bug report capture is a secondary path from
inside the same messenger-style window. Explicit Quira bug/feedback reports are
saved to Quira conversations and support cases with product/screen/session
context, rating, browser context, and screenshot metadata.

## Admin Review

The V1 backend stores the Admin review objects needed for the Support area:

- `quira_knowledge_articles`: curated support KB, published flag, product,
  category, tags, audience, source metadata, and vector sync state.
- `quira_conversations`: signed-in chat sessions.
- `quira_messages`: user and assistant turns.
- `quira_tool_events`: tool calls and outputs.
- `quira_leads`: public and signed-in follow-up requests.
- `quira_support_cases`: Admin inbox items with `new`, `triage`,
  `in_progress`, and `resolved` statuses.

Admin now has practical V1 support workflow controls:

- inbox listing with status/urgency/kind/product/screen/user context
- lead listing with public/signed-in source and product interest
- status update controls for each case
- conversation detail view with recent stored messages
- vector sync visibility for published knowledge articles

## Required Environment

- `DATABASE_URL` for storage.
- `OPENAI_QUIRA_API_KEY`, `OPENAI_SUPPORT_API_KEY`, or `OPENAI_API_KEY` for AI
  responses.
- Optional model overrides: `OPENAI_QUIRA_MODEL` or `OPENAI_SUPPORT_MODEL`.
- Optional vector store: `OPENAI_QUIRA_VECTOR_STORE_ID`.

If no support AI key is configured, the API still saves the user message and
returns a clear unavailable response instead of pretending the chat answered.

## Backend Smoke Harness

Use `npm run smoke:quira` from the live worktree to run disposable backend
conversation checks. The harness loads `.env.local` or `.env`, seeds a reviewed
Quira knowledge article and an open known issue, runs a public access-level
multi-turn support chat, runs a signed-in bug-report chat, verifies persisted
messages, AI run logging, and answer feedback, reports whether tool events and
support-case creation happened, then removes its `[TEST_DELETE]` rows. Add
`--strict` when you want the bug-report scenario to fail unless Quira records a
tool event and creates a bug support case.

Accepted AI key sources are `OPENAI_QUIRA_TEST_TUNNEL_API_KEY`,
`OPENAI_QUIRA_API_KEY`, `OPENAI_SUPPORT_API_KEY`,
`OPENAI_INTERVIEW_TEST_TUNNEL_API_KEY`, or `OPENAI_API_KEY`.

Run one scenario at a time when isolating behavior:

- `npm run smoke:quira -- --scenario=public_kb`
- `npm run smoke:quira -- --scenario=signed_in_bug`
- `npm run smoke:quira -- --scenario=signed_in_bug --strict`

## Future Support Ops Lane

Future Quira work should evaluate owner notifications for important support
events, such as new bug reports, blocked workflows, repeated failed voice
starts, or high-urgency cases. Candidate channels include SMS, Slack, WhatsApp,
or email. This should stay separate from the core chat prompt until the owner
notification channel, escalation thresholds, privacy boundaries, and cost model
are selected.

Later assisted-triage work may let Quira or a Codex-backed support workflow
gather safe diagnostics and suggest likely failure points. That work must avoid
exposing secrets, raw private transcripts, hidden prompts, or direct production
write actions without an explicit operator-approved workflow.

## Migration Requirement

Production must include migrations through
`drizzle/0081_expand_quira_support_database.sql` before current known issues,
case triage, attachments, answer feedback, and Admin support review will
function.
