---
phase: 2
title: "Backend"
status: pending
priority: P2
dependencies: [1]
effort: "3h"
---

# Phase 2: Backend

## Overview

Implement backend API endpoints for module management using the existing Configuration model.

## Requirements

### Functional
- GET `/api/v1/modules` - List all modules with their activation states
- PATCH `/api/v1/modules/:id` - Toggle module activation state
- Enforce module dependency rules
- Prevent disabling always-active modules (core)

### Non-Functional
- Use existing Configuration model for persistence
- Apply AuthGuard and TenantGuard
- Return tenant-scoped results

## Architecture

```
ModulesController → ModulesService → ConfigurationService
                    ↓
              ModuleRegistry (static)
```

### ModuleRegistry Structure
```typescript
interface ModuleDefinition {
  id: string;           // 'core', 'escandallos', etc.
  name: string;         // Display name
  description: string;  // User description
  dependencies: string[]; // Required module IDs
  alwaysActive: boolean; // Cannot be disabled
  defaultEnabled: boolean;
}
```

### Configuration Key Pattern
`modules.{moduleId}.enabled = "true" | "false"`

## Related Code Files

### Create
- `backend/src/modules/modules/modules.controller.ts` - API endpoints
- `backend/src/modules/modules/modules.service.ts` - Business logic
- `backend/src/modules/modules/modules.module.ts` - Module definition
- `backend/src/modules/modules/dto/module.dto.ts` - DTOs
- `backend/src/modules/modules/constants/registry.ts` - Module registry

### Modify
- `backend/src/app.module.ts` - Import ModulesModule

## Implementation Steps

1. **Create module registry** (`registry.ts`)
   - Define all 5 modules with metadata
   - Mark core as `alwaysActive: true`
   - Define dependencies (e.g., production depends on almacenes)

2. **Create DTOs** (`dto/module.dto.ts`)
   - `ModuleDto` - API response for module state
   - `UpdateModuleDto` - Toggle request validation
   - Add dependency conflict error response

3. **Create ModulesService** (`modules.service.ts`)
   - `getModules()` - Fetch all modules with current states
   - `toggleModule(id: string, enabled: boolean)` - Update state
   - `validateToggle(id: string, enabled: boolean)` - Check dependencies
   - Initialize missing configurations with defaults

4. **Create ModulesController** (`modules.controller.ts`)
   - GET `/api/v1/modules` - List all modules
   - PATCH `/api/v1/modules/:id` - Toggle module
   - Apply `@UseGuards(AuthGuard, TenantGuard)`

5. **Register module** (`modules.module.ts`)
   - Import ConfigurationService
   - Export ModulesController

6. **Wire in app.module.ts**
   - Import ModulesModule

## Success Criteria

- [ ] GET `/api/v1/modules` returns all 5 modules with correct states
- [ ] PATCH `/api/v1/modules/core` returns 403 (cannot disable core)
- [ ] PATCH with valid request updates Configuration model
- [ ] Module dependencies enforced
- [ ] Endpoints protected with auth guards
- [ ] Missing configurations auto-initialized to defaults

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Configuration service changes needed | Use existing ConfigurationService; add methods only if missing |
| Module registry desync with actual modules | Keep registry simple; document sync responsibility |
| Performance issues with many modules | Cache module states in service if needed |

## Edge Cases

- Disabling a module that other modules depend on → Error with list of dependents
- Missing configuration entries → Auto-initialize with defaults
- Non-existent module ID → 404 error