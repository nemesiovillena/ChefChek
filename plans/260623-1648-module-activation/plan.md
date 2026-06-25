---
title: "Module Activation System"
description: "Enable/disable modules from settings page with persistence and dependency management"
status: completed
priority: P2
branch: "main"
tags: ["modules", "settings", "activation"]
blockedBy: []
blocks: []
created: "2026-06-23T15:10:31.617Z"
createdBy: "ck:plan"
source: skill
---

# Module Activation System

## Overview

Add the ability to activate and deactivate application modules from the settings page at `/dashboard/settings`. The current static module list will be replaced with an interactive UI that allows toggling module activation state. Module states will be persisted per-tenant using the existing Configuration model.

## Problem Statement

The settings page currently displays a hardcoded list of modules with static "Active" badges. There is no way for users to:
- Disable modules they don't need
- Enable modules on demand
- See which modules are actually active
- Manage module preferences

## Solution Approach

### Architecture Decision

Use the existing **Configuration model** for storing module activation states. This avoids creating new database tables and leverages the existing tenant-scoped configuration infrastructure.

**Key Format:** `modules.{moduleName}.enabled = "true" | "false"`

### Module Registry

Create a centralized module registry that defines:
- Available modules (core, escandallos, seguridad, production, almacenes)
- Display names and descriptions
- Dependencies between modules
- Default activation state

## Phases

| Phase | Name | Status | Effort |
|-------|------|--------|--------|
| 1 | [Research](./phase-01-research.md) | ✅ Completed | 1h |
| 2 | [Backend](./phase-02-backend.md) | ✅ Completed | 3h |
| 3 | [Frontend](./phase-03-frontend.md) | ✅ Completed | 3h |
| 4 | [Integration](./phase-04-integration.md) | ✅ Completed | 2h |
| 5 | [Test](./phase-05-test.md) | ✅ Completed | 2h |

**Total Estimated Effort:** 11 hours

## Dependencies

- Existing `Configuration` model in database
- Existing `/dashboard/settings` page structure
- `AuthGuard` and `TenantGuard` for access control

## Acceptance Criteria

1. ✅ Users can view all available modules in the settings page
2. ✅ Each module shows its current activation state (Active/Inactive)
3. ✅ Users can toggle module activation using a switch UI
4. ✅ Module states persist per-tenant across sessions
5. ✅ Core module cannot be disabled (always active)
6. ✅ Module dependencies are enforced (e.g., disabling a module disables its dependents)
7. ✅ API endpoints are protected with auth/tenant guards
8. ✅ Optimistic UI updates with rollback on error

## Open Questions

- Should module activation be logged/audited?
- Should there be a confirmation dialog when disabling modules with active features?
- Should there be a "reset to defaults" option?

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Disabling a module breaks active workflows | Medium | High | Add dependency enforcement; warn user before disabling |
| Configuration model performance issues | Low | Medium | Cache module states in memory |
| Module registry becomes stale | Medium | Low | Keep registry synchronized with actual modules |

## Rollback Plan

If issues arise:
1. Revert frontend changes to static module list
2. Disable new API endpoints via guards
3. Existing configurations remain unaffected