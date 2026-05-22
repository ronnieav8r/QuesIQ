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

2. Evaluation provider:
   - exact model/provider for post-session review
   - structured output contract and cost controls

3. Migration:
   - start with new beta users only
   - or migrate selected Bubble user/session data later

## Decisions To Make Later

- Whether direct OpenAI Realtime reveals a reason to fall back to VAPI
- Whether native mobile apps are warranted
- Whether Quira and the app backend should share infrastructure
- Whether stories or job targets become first-launch requirements
