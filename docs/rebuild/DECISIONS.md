# Decisions

## Decided

### Replace Bubble For The Coded Rebuild

The rebuild target is a custom app that owns the core QuesIQ Interview product
logic and UI outside Bubble.

### Keep Existing Material As Reference

Bubble screens, Claude handoffs, context packs, and current docs inform the
rebuild. They do not force implementation parity or preserve old constraints.

### Use Direct OpenAI Realtime First For Browser Voice

The first coded browser voice path should use direct OpenAI Realtime, with the
app backend mediating sensitive session configuration. A manual 2026-05-22 spike
proved browser microphone connection, Que first-turn speech, audio quality,
transcript/events, and disconnect behavior well enough to prefer this route
while phone calls are out of scope.

### Keep VAPI As A Voice Fallback

VAPI remains a fallback option if direct OpenAI Realtime later shows a material
quality, reliability, transcript, provider-flexibility, or tooling gap.

### Keep Que And Quira Distinct

- Que: in-app interview coach
- Quira: public/support text assistant

They may share brand context later, but they are separate product surfaces.

### Use The New Rebuild Repository

The coded rebuild now lives in the new GitHub repository:

- Local clone: `C:\Users\weeks\Documents\GitHub\QuesIQ`
- GitHub: `ronnieav8r/QuesIQ`

The older QuesIQ workspace remains a reference source for Bubble handoffs,
product docs, and rebuild planning history.

### Design Mobile And Desktop Intentionally

The app should be responsive with two deliberate experiences:

- Mobile: focused single-column app flows, bottom navigation, and large tap
  targets.
- Desktop: a wider workspace where dashboard, history, review, and story work
  can use more room.

Practice setup and live voice sessions should stay focused at every size rather
than becoming cluttered desktop dashboards.

### Use Drizzle For Postgres Schema And Migrations

The first app-owned persistence slice uses Drizzle ORM against Postgres with
checked-in Drizzle migrations. The initial migration is intentionally narrow:
create the Session launch record before browser voice starts, then extend the
schema as transcript retention, auth, and evaluation contracts are decided.

### Use Auth.js When Auth Lands

Auth.js is the auth direction for the first coded app auth slice. Session
creation can land before protected routes while the app is still operating as a
thin rebuild slice, but durable user ownership should be added through the auth
slice before beta history and progression depend on it.

The first Auth.js implementation uses email magic links for the primary
user-facing sign-in path without adding app-owned password storage yet. Google
OAuth is enabled as a second user-friendly option, and GitHub is retained for
developer/admin convenience. Google OAuth is allowed to link to an existing
email-owned account when the verified email matches. New Session launch and its
direct voice persistence boundaries require the authenticated Session owner.

The app shell is auth-gated for V1 readiness: signed-out users see the sign-in
screen, and Home, History, Practice, Stories, Me, and live Sessions are only
available after sign-in.

### Keep Product Channels In The QuesIQ App By Default

Interview, Learn, Stories, Jobs, profile, and other shared-user QuesIQ product
channels should default to routes/modules inside the same QuesIQ app and shared
product database. Separate Render services are for real product, deploy,
security, scaling, or operational boundaries, not every channel.

Que and Quira remain distinct product surfaces. While the older Quira Render
service path is being repointed to the active QuesIQ rebuild to avoid paying for
two unused app services now, Quira can return to its own deploy boundary later
when it needs to be live separately.

### Store Beta Voice Transcript Artifacts Before Audio

The first direct voice beta stores the app-owned Session launch snapshot,
transcript turns, lifecycle events, start/end metadata, and direct OpenAI
Realtime call correlation metadata needed for evaluation and debugging.

Do not store raw session audio in this first artifact slice. Revisit recording
retention only when a product, evaluation, support, or compliance need justifies
the added privacy and storage surface.

### Evaluate Saved Transcript Artifacts First

The first evaluation slice uses the saved Session transcript artifact to create
an owned, structured practice review with five score dimensions: Confidence,
Clarity, Relevance, Impact, and Authenticity.

Evaluation is stored as derived feedback on the app-owned Session path. This
keeps the beta review loop useful without expanding retention to raw audio.

The seeded live beta prompt configs are:

- Interview voice model: `gpt-realtime`
- Post-session evaluation model: `gpt-5.4-mini`

After prompt config migrations run, active Postgres prompt config records are
the runtime source for live voice and evaluation instructions/model settings.
The checked-in defaults remain a fallback if prompt config records are not
available.

### Use Versioned Prompt Configs For AI Calls

Realtime interviewer and post-session evaluation prompts are composed product
configuration, not one-off implementation strings. Store base prompts in
versioned Postgres prompt config records, store mode/question/style prompt
instructions on backend catalog records, gate editing behind `ADMIN_EMAILS`, and
save the base prompt config version used on Sessions and Evaluations.

Admin edits should create a new version. Activating a version should not rewrite
historical base prompt records. Catalog prompt component edits can update the
current mode/question/style instructions directly while the beta prompt surface
is still small.

### Track AI Runs In The App Before Exporting

QuesIQ should own AI call observability in Postgres before exporting to external
ops tools. API calls with clear provider usage, such as post-session
Evaluations, should create exact-token API call records. Realtime voice sessions
should use a separate compact usage table with duration, transcript split,
model, voice, estimated audio tokens, estimated cost, pricing version, and
estimation method.

Do not store raw Realtime event streams or audio by default for cost tracking.
Use configurable estimation assumptions and audit them against provider billing
over time.

Google Sheets can become the daily ops hub through export/sync after the app
data is reliable. Do not build spreadsheet-like admin functionality inside the
app before the daily reporting questions are clearer.

### Keep Pricing Editable And Checked, Not Silently Auto-Changed

AI pricing belongs in editable app-owned pricing records. Cost calculations
should read active pricing records and store the pricing version used on derived
usage rows where practical.

A monthly AI pricing review can use OpenAI web search and structured JSON to
compare current app pricing against
`https://developers.openai.com/api/docs/pricing`, which is the source of truth
for pricing review. Treat that output as a candidate report for admin approval.
After review, an admin can accept the candidate changes into new active pricing
records. Acceptance must only apply verified candidates for exact existing model
and modality pairs; audio pricing must never be replaced by text-token pricing
for the same model name.

### Persist Profile Context Separately From Session Snapshots

User-owned onboarding/profile context is stored in a Profile record and copied
into each Session setup snapshot when practice launches. This keeps current
user context reusable while preserving the exact context that produced each
historical Session.

Current persisted profile fields are preferred name, target role, target
company, job description, resume filename, resume metadata, and parsed resume
text. Raw resume file binaries are not retained yet; the first beta slice stores
parsed text directly in Postgres so Que and post-session evaluation can use it
without adding object storage.

TXT, MD, DOCX, and most PDFs are the first supported resume parsing targets.
Legacy `.doc` files remain filename-only until there is a strong need to support
that older format.

### Keep Review Creation Inline For Now, But Retryable

Post-session review creation still runs inline after the voice artifact saves.
Sessions now track evaluation status and last evaluation error so missing or
failed reviews can be reopened and retried without adding a queue yet.

### Own Interview Catalog Records In The Backend

Practice modes, question types, and interviewer styles are seeded Postgres
catalog records. The frontend loads them through `/api/catalog` so product
configuration can move out of hardcoded UI data over time.

Checked-in catalog defaults remain in the client as a resilience fallback. The
canonical deployed path is the backend catalog once migrations have run.

## Working Recommendations

These are strong defaults until we decide otherwise:

- Build the app in TypeScript.
- Use Postgres for product data.
- Use Render/GitHub for the first coded deployment path.
- Keep core session/evaluation/progression logic in the backend, not Make.
- Keep the app responsive with first-class mobile and desktop layouts.

## Open Decisions Before The Next Large Slice

1. Storage:
   - resume storage provider
   - whether a later beta or review workflow needs stored voice recordings

2. Evaluation hardening:
   - cost controls
   - whether inline retry is enough or a queued worker is needed later
   - richer prompt/config observability

3. Migration:
   - start with new beta users only
   - or migrate selected Bubble user/session data later

## Decisions To Make Later

- Whether direct OpenAI Realtime reveals a reason to fall back to VAPI
- Whether native mobile apps are warranted
- Whether Quira and the app backend should share infrastructure
- Whether stories or job targets become first-launch requirements
