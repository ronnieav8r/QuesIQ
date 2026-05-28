# QuesIQ DPE Pilot App Alignment Guide

Status: implementation guide for a separate DPE pilot checkride app that should be merge-ready for the broader QuesIQ platform later.
Last updated: 2026-05-28

## Purpose

Build the DPE pilot checkride app as its own focused product now, while keeping it easy to merge into the broader QuesIQ platform later. Do not merge it into QuesIQ Interview yet. Do not create a shared platform shell yet. The current goal is a clean, useful, aviation-specific app that feels like a sibling product in the QuesIQ family and can later share auth, design system, billing, support, and product navigation without a painful rewrite.

The DPE app should feel like a serious pilot training and checkride-prep workspace: calm, precise, mobile-first, and operational. Avoid marketing pages, oversized hero sections, decorative dashboards, or toy-like aviation visuals.

## Product Boundary

- Keep the DPE pilot checkride app as a separate app/repo/product surface for now.
- Do not merge DPE data tables into QuesIQ Interview tables.
- Do not rename Interview concepts to generic platform concepts inside the Interview app yet.
- Do not build shared billing, cross-product navigation, or a shared QuesIQ account dashboard yet.
- Keep the DPE app shaped so later platform integration is straightforward.
- Treat QuesIQ Interview as the lead product whose UI system, auth direction, and admin/observability patterns define the current family standard.

## Merge-Later Architecture

Use this mental model:

- `user`, `account`, `session`, and `verificationToken` are generic identity tables.
- DPE-specific records belong in DPE-owned tables keyed by `user_id`.
- Interview-specific records belong in Interview-owned tables keyed by `user_id`.
- Shared platform tables such as billing, product entitlements, cross-product dashboards, and shared product membership are later work.

Recommended DPE table naming:

- `dpe_profiles`
- `dpe_checkride_targets`
- `dpe_sessions`
- `dpe_scenarios`
- `dpe_oral_questions`
- `dpe_written_reviews`
- `dpe_progression_events`
- `dpe_user_progression`
- `dpe_feedback`
- `dpe_diagnostic_events`

Avoid generic table names like `profiles`, `sessions`, `evaluations`, or `progression_events` unless the repo is intentionally single-product and the future migration plan is documented. Product-prefixed names make a later merge less ambiguous.

## Data Rules

- Do not add product-specific fields to the generic `user` table.
- Store DPE user preferences in a DPE profile table.
- Store checkride goals separately from user identity. Examples: certificate/rating, aircraft category/class, checkride date, DPE name, school, aircraft, weak ACS areas.
- Preserve exact session snapshots. If a mock oral session uses a given certificate/rating, ACS area, scenario, or pilot profile, store that context with the session so historical reviews remain explainable.
- Store transcript artifacts before considering raw audio. Raw audio should be deferred unless there is a clear product/support/compliance reason.
- Keep deletion/ownership boundaries simple: all DPE product data should be owned through `user_id`.

## Auth Direction

If auth is needed in the DPE app, follow QuesIQ Interview's direction:

- Auth.js-compatible user/account/session model.
- Email magic link as the primary nontechnical path.
- Google OAuth as a user-friendly option.
- GitHub only for developer/admin convenience if useful.
- Signed-out users should see a sign-in screen, not the app workspace.

Do not build app-owned password auth unless explicitly directed.

## AI And Voice Direction

Use direct OpenAI Realtime first for browser voice practice if voice is part of the DPE pilot app. Keep VAPI as a fallback idea, not the default implementation.

AI surfaces should be instrumented from the beginning:

- Responses API calls create `ai_runs` rows or the DPE equivalent.
- Realtime exchange endpoints create AI run rows for setup success/failure.
- App-owned voice sessions save usage after the artifact is persisted.
- Store model, prompt config key/version, provider request id, status, duration, token usage when available, and estimated cost when possible.
- Store diagnostic events for failed API calls, Realtime errors, and client errors.
- Do not store raw prompts, auth headers, secrets, raw audio, or giant transcripts in diagnostics.

If there are editable prompts, follow QuesIQ Interview's Admin prompt-config pattern:

- Prompt configs are versioned records.
- Activating a new prompt version does not rewrite history.
- Sessions/reviews store the prompt config key/version used.
- Static schema text can stay in code, but product instructions should be admin-visible when practical.

## DPE Product Concepts

Use aviation-native concepts instead of copying Interview labels too literally.

Suggested top-level product concepts:

- Home: next best practice action, recent checkride progress, weak ACS areas.
- Practice: start an oral checkride practice, scenario, maneuver brief, or rapid-fire ACS review.
- Scenarios: saved checkride scenarios, cross-country situations, risk-management prompts.
- History: prior oral sessions, feedback, transcript-backed reviews.
- Me: pilot profile, certificate/rating target, aircraft, checkride date, school/instructor context.
- Admin: prompt configs, AI usage, diagnostics, feedback, scenario/question banks.

Suggested first practice modes:

- Mock Oral
- ACS Rapid Fire
- Scenario-Based
- Weak Area Review
- First Impression / Checkride Opening

Suggested score dimensions:

- Knowledge
- Risk Management
- Scenario Judgment
- Communication
- Checkride Readiness

Keep score dimensions stable once reviews are stored. If they change later, version the rubric.

## UI Goal

The DPE app should visually match QuesIQ Interview and the Study alignment guide:

- Dark, framed app workspace.
- Compact header.
- Mobile bottom nav.
- Desktop left rail.
- Purple active/focus states.
- Orange primary actions.
- Muted, readable text.
- Small-radius panels/cards.
- Lucide icons.
- No emoji as functional UI icons.
- No aviation clip-art, fake cockpit dashboards, giant hero illustrations, or decorative gradients as the main experience.

The visual feel should be professional pilot training software, not a marketing landing page and not a game.

## Exact Design Tokens

Use these canonical QuesIQ tokens. If the app already has another token system, migrate gradually with aliases, but new CSS should use these names.

```css
:root {
  color-scheme: dark;

  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;

  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-full: 999px;

  --font-size-xs: 0.78rem;
  --font-size-sm: 0.82rem;
  --font-size-base: 1rem;
  --font-size-md: 1.125rem;
  --font-size-lg: 1.25rem;
  --font-size-xl: 1.9rem;
  --font-size-2xl: 2.35rem;

  --line-tight: 1.15;
  --line-copy: 1.5;

  --action: #e8721a;
  --action-pressed: #c96115;
  --background: #080d1c;
  --brand: #6d3bff;
  --brand-strong: #8c52ff;
  --border: rgba(140, 82, 255, 0.36);
  --focus: #8c52ff;
  --focus-soft: rgba(109, 59, 255, 0.2);
  --muted: #b9bfd8;
  --surface: #10172a;
  --surface-band: #0d1326;
  --surface-raised: #151b33;
  --surface-hover: #1b2341;
  --text: #f5f7fb;
  --shadow-soft: 0 1rem 2.75rem rgba(0, 0, 0, 0.34);
  --shadow-brand: 0 0 2rem rgba(109, 59, 255, 0.2);
  --transition-fast: 140ms ease;

  --success: #38b692;
  --warning: #e8b41a;
  --danger: #e85c4a;
}
```

### Color Usage

- Page background: `--background`.
- Main app frame: `--surface`.
- Large panels/section bands: `--surface-band`.
- Cards, inputs, stat chips, table cells, and raised controls: `--surface-raised`.
- Hover state: `--surface-hover` or `--focus-soft`.
- Primary action buttons: orange using `--action` and `--action-pressed`.
- Active nav, selected tabs, selected filters, focus outlines: purple using `--focus` / `--focus-soft`.
- Main text: `--text`.
- Secondary text: `--muted`.
- Borders: `--border`.
- Pass/ready/success states: `--success`.
- Caution/needs work states: `--warning`.
- Fail/error/delete states: `--danger`.

Do not create a one-off aviation palette based on blue skies, beige charts, or cockpit greens. Aviation flavor should come from content and icon choices, not from diverging from the QuesIQ system.

## Shell Template

Use this shell architecture:

```tsx
<div className="product-shell">
  <div className="app-frame">
    <header className="app-header">...</header>
    <main className="app-body">...</main>
    <nav className="tab-bar">...</nav>
  </div>
</div>
```

Shell rules:

- `product-shell` fills the viewport and gives the app breathing room.
- `app-frame` is centered, dark, bordered, and app-like.
- Mobile uses compact header, scrollable body, and bottom nav.
- Desktop uses a persistent left rail.
- Main body scrolls; the whole page should not scroll behind fixed elements.
- Use `100dvh` where possible for stable mobile height.
- Desktop max width should be around `78rem`.

## Navigation

Recommended nav:

- Home: `Home`
- Practice: `Mic` or `Radio`
- Scenarios: `Map`
- History: `History`
- Me: `User`

Admin belongs behind access control. Do not expose Admin to ordinary users.

Bottom nav:

- Visible by default.
- Labels remain visible.
- Use at least 44px tap targets.
- If a collapse pattern is added, make it explicit like Interview's Menu handle. Do not auto-hide on scroll in the first pass.

## Component Rules

- Use panels for major sections.
- Use cards only for repeated items or framed tools.
- Do not put cards inside cards.
- Keep border radius at `--radius-sm` or `--radius-md`.
- Keep headings sized to their container. Do not use hero-scale type inside panels.
- Keep text wrapping clean on mobile.
- Avoid inline styles except dynamic progress widths or unavoidable computed values.
- Use shared class names where possible: `screen`, `screen-toolbar`, `section-head`, `panel`, `raised-card`, `stat-strip`, `stat-chip`, `inline-actions`, `segmented-control`, `tab-bar`.

## Button And Input Rules

- Primary actions are orange.
- Secondary actions are quiet dark/purple.
- Destructive actions use danger styling.
- Focus-visible outlines use `--focus`.
- Inputs use `--surface-raised`, `--border`, `--text`, and `--focus`.
- Do not use tiny form controls for mobile-first workflows.

## Icon Policy

Use `lucide-react`.

Suggested icons:

- Home: `Home`
- Practice voice: `Mic`, `Radio`, `AudioLines`
- Scenario: `Map`, `Route`, `CloudSun`, `Gauge`
- Checkride target: `BadgeCheck`, `ClipboardCheck`
- ACS/task list: `ListChecks`
- History: `History`
- Profile: `User`
- Aircraft: `Plane`
- Warning/risk: `TriangleAlert`
- Weather: `CloudSun`
- Edit/delete: `Pencil`, `Trash2`
- More/menu: `MoreHorizontal`, `Menu`

Do not use emoji as UI icons. Do not hand-code SVGs when lucide has a reasonable icon.

## Copy And Tone

Use clear aviation language, but keep it plain:

- Prefer `Checkride Target` over vague `Goal`.
- Prefer `ACS Area` over generic `Category`.
- Prefer `Oral Practice` over generic `Session` when the context is oral prep.
- Prefer `Risk Management` and `Scenario Judgment` over broad coaching words.

Avoid jokey copy. DPE prep is high-stakes; the tone should be calm, direct, and confidence-building.

## Suggested Screens

### Home

Home should answer:

- What should I practice next?
- What checkride am I preparing for?
- What areas are weakest?
- What have I recently completed?

Structure:

1. Welcome row with checkride target summary.
2. Recommended Next panel.
3. Progress/Readiness stat strip.
4. Recent sessions.
5. Weak ACS areas.

### Practice

Practice should start a useful session quickly.

Inputs:

- Certificate/rating target.
- Practice mode.
- ACS area or scenario type.
- Examiner style if used.
- Optional aircraft/checkride context.

Rules:

- Keep setup focused.
- Do not make users fill every possible aviation field before first practice.
- Save reusable checkride targets in Me/Profile, not only per session.

### Scenarios

Scenarios should be reusable assets, similar to Story Lab assets in Interview.

Each scenario should have:

- Title.
- Certificate/rating relevance.
- ACS area(s).
- Situation.
- Expected decision points.
- Risk-management focus.
- Optional ideal answer notes.
- Practice action.

Scenarios should be editable after AI generation.

### Session

The live oral practice screen should be focused:

- Readiness panel.
- Start/End voice controls.
- Compact timer.
- Transcript artifact.
- Connection details behind disclosure.
- Clear error state.

Use the Interview Realtime session visual language.

### Review

Reviews should be transcript-backed and structured:

- Summary.
- Scores.
- Evidence.
- What worked.
- What to sharpen.
- ACS or risk-management misses.
- Next practice action.
- Transcript.

Do not create a second written debrief flow unless there is a distinct need. If debrief exists, prefer voice debrief tied to a completed session.

### Me

Profile fields:

- Preferred name.
- Certificate/rating target.
- Checkride date.
- Aircraft.
- Flight school/instructor.
- DPE name if known.
- Personal weak areas.
- Notes.

Keep these product-specific fields out of the generic user table.

## Admin Expectations

If the DPE app has Admin:

- Prompt configs.
- AI usage.
- Realtime usage.
- Diagnostics.
- Feedback/bugs.
- Scenario/question bank.
- Users/data inspection.

Admin should be gated by explicit admin email/env config.

## Diagnostics And Feedback

Build beta visibility early:

- Feedback button/support launcher on every signed-in screen.
- Store screen, session id, browser language, viewport, user agent, optional screenshot, rating prompt, rating, and message.
- Add diagnostics for failed API calls, Realtime errors, and browser errors.
- Keep diagnostics sanitized.

Do not hide important beta failure signals only in server logs.

## Branch And Repo Hygiene

- Use scoped branches for feature work.
- Keep docs current when durable product or architecture decisions change.
- Avoid broad refactors while the product shape is still moving.
- Keep reference docs separate from current implementation docs.
- Do not copy QuesIQ Interview code blindly; copy patterns deliberately.

If the DPE repo uses Codex concurrently with this Interview repo, include a short `AGENTS.md` with:

```md
# Agent Notes

This repository is the DPE pilot checkride app for the QuesIQ product family.
Keep it separate for now, but merge-ready later.

- Match QuesIQ Interview UI tokens, shell rhythm, Admin observability, and auth direction.
- Keep DPE product data in DPE-owned tables keyed by `user_id`.
- Do not add product-specific fields to the generic auth user table.
- Instrument every new AI feature in Admin AI Usage.
- Capture sanitized diagnostics for failed API/Realtimes/client errors.
- Keep prompt surfaces admin-versioned when they affect product behavior.
- Preserve clean mobile-first app UX; avoid marketing pages as the primary screen.
```

## Acceptance Checklist

Before handing off:

- DPE app remains separate, but merge-ready.
- Auth model can align with QuesIQ Interview/Auth.js later.
- Product data is namespaced/prefixed and keyed by `user_id`.
- UI uses QuesIQ tokens and dark app shell.
- Primary actions are orange.
- Active/focus states are purple.
- Semantic states use success/warning/danger.
- Mobile bottom nav and desktop rail are consistent with Interview.
- Functional icons use lucide.
- No emoji functional icons.
- No hand-coded SVGs where lucide fits.
- No marketing hero as the app's first screen.
- AI calls are instrumented.
- Realtime sessions/errors are observable.
- Feedback and diagnostics are visible in Admin.
- Docs state any decisions that would affect a later merge.

## Verification

Run the repo's equivalent of:

```powershell
npm run lint
npm run typecheck
npm run build
```

If the app has a local preview, verify mobile and desktop layouts before handing off.
