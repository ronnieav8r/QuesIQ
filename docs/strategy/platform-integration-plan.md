# QuesIQ Platform Integration Plan

Status: strategy / future planning. This plan should guide later platform
decisions, but it is not an active implementation constraint until reflected in
`docs/rebuild/DECISIONS.md` or the current handoff/status docs.

This document outlines the planned architecture and integration strategy for bringing QuesIQ Interview and QuesIQ Study under one shared platform with shared authentication, billing, and UI systems.

Key goals:
- Shared login and user database
- Shared billing/subscription system
- Shared design system
- Modular products under one platform
- Codex as lead integrator
- Claude used for isolated feature work
- Avoiding a tangled mega-app
- Avoiding AI merge conflicts through disciplined branching and PR workflows
