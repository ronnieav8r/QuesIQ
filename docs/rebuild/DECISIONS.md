# Decisions

## Decided

### Replace Bubble For The Coded Rebuild

The rebuild target is a custom app that owns the core QuesIQ Interview product
logic and UI outside Bubble.

### Keep Existing Material As Reference

Bubble screens, Claude handoffs, context packs, and current docs inform the
rebuild. They do not force implementation parity or preserve old constraints.

### Keep VAPI For The First Voice Beta

VAPI remains the voice runtime at the start. Replacing VAPI would create a
separate real-time voice infrastructure project and is not required to remove
Bubble.

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

## Working Recommendations

These are strong defaults until we decide otherwise:

- Build the app in TypeScript.
- Use Postgres for product data.
- Use Render/GitHub for the first coded deployment path.
- Keep core session/evaluation/progression logic in the backend, not Make.
- Keep the app responsive with first-class mobile and desktop layouts.

## Open Decisions Before The Next Large Slice

1. Web stack specifics:
   - ORM/migration tool
   - auth provider

2. Storage:
   - resume storage provider
   - whether any recordings are stored by us in the first beta

3. Evaluation provider:
   - exact model/provider for post-session review
   - structured output contract and cost controls

4. Migration:
   - start with new beta users only
   - or migrate selected Bubble user/session data later

## Decisions To Make Later

- Whether and when to replace VAPI
- Whether native mobile apps are warranted
- Whether Quira and the app backend should share infrastructure
- Whether stories or job targets become first-launch requirements
