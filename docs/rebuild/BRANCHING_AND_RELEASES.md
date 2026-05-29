# Branching And Releases

Last updated: 2026-05-29

## Goal

Keep development fast while making the live app easy to reason about and easy to
roll back.

## Branch Roles

- `main`: stable integration branch for completed work.
- `live`: exact code intended for `quesiq.com` production deploys, once the
  branch is established from the confirmed production state.
- `codex/*`: feature, fix, and documentation branches used by Codex.
- `hotfix/*` or `codex/hotfix-*`: urgent fixes based from `live` when production
  is affected.

Do not create or repoint the production Render service to `live` until the
current production commit is confirmed. Creating `live` from the wrong commit
would make the branch name comforting but inaccurate.

## Normal Flow

1. Start feature work from current `main` on a `codex/*` branch.
2. Keep changes scoped and update docs when durable decisions change.
3. Run the relevant local checks before merge. The usual baseline is lint,
   TypeScript, and production build unless the change is docs-only.
4. Merge finished work into `main`.
5. Promote `main` to `live` only when the release is intentionally approved for
   production.
6. Deploy production from `live` after Render is configured for the branch.

## User Preference

The user wants Codex to handle commit/push/deploy-prep when requested rather
than leaving manual GitHub work to them. The user is not a coder and should not
be treated as the final line of code review. Codex should verify changes with
the appropriate checks, summarize what changed and what risk remains in plain
language, then make the next release action explicit.

## Hotfix Flow

1. Branch from `live`.
2. Apply the smallest safe fix.
3. Run the narrowest checks that cover the risk.
4. Merge to `live` and deploy.
5. Merge the same fix back into `main` so the next release does not regress it.

## Production Promotion Checklist

- Confirm migrations are safe to run once and forward-only.
- Confirm required Render environment variables are present.
- Run lint, TypeScript, and production build unless the release is docs-only.
- Check high-risk user flows touched by the release.
- Confirm `docs/rebuild/HANDOFF.md` and `docs/rebuild/CURRENT_STATUS.md` are
  current enough for the next resume.
- Tag or note the deployed commit after production QA.

## Current Render Note

`quesiq.com` currently points at the active Render service `quesiq-web`. The
docs say production deploys are still being user-confirmed on that service.
Before switching Render to deploy from `live`, confirm the exact commit currently
serving production and decide whether any pending `main` changes should be
released first.
