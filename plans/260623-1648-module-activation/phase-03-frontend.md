---
phase: 3
title: "Frontend"
status: pending
priority: P2
dependencies: [2]
effort: "3h"
---

# Phase 3: Frontend

## Overview

Replace the static module list with an interactive UI that fetches module states from the backend and allows toggling.

## Requirements

### Functional
- Fetch and display all modules with current activation states
- Toggle modules using switch UI
- Show loading and error states
- Prevent toggling always-active modules
- Display dependency warnings

### Non-Functional
- Optimistic UI updates with rollback on error
- Responsive design matching existing settings page
- Accessible toggle controls

## Architecture

```
ModuleListWidget (new component)
  → useModules (hook)
    → fetchModuleStates()
    → toggleModule()
```

### Component Structure
```
ModuleListWidget/
  ├── ModuleCard/
  │   ├── ModuleHeader (name + description)
  │   ├── ModuleStatus (badge)
  │   └── ModuleSwitch (toggle, disabled for alwaysActive)
  └── DependencyWarning (when applicable)
```

## Related Code Files

### Create
- `frontend/src/features/modules/hooks/use-modules.ts` - Custom hook for module operations
- `frontend/src/features/modules/api/modules-api.ts` - API client functions
- `frontend/src/features/modules/types/module.types.ts` - TypeScript types
- `frontend/src/features/modules/components/module-list-widget.tsx` - Main UI component
- `frontend/src/features/modules/components/module-card.tsx` - Individual module card

### Modify
- `frontend/src/app/dashboard/settings/page.tsx` - Replace static list with ModuleListWidget

## Implementation Steps

1. **Create TypeScript types** (`types/module.types.ts`)
   - `Module` interface matching backend DTO
   - `ToggleModuleRequest` type
   - `ModuleStatus` enum

2. **Create API client** (`api/modules-api.ts`)
   - `fetchModuleStates()` - GET request
   - `toggleModule(id: string, enabled: boolean)` - PATCH request
   - Use existing auth headers from `getAuthHeaders()`

3. **Create custom hook** (`hooks/use-modules.ts`)
   - Fetch module states on mount
   - Provide `toggleModule()` function with optimistic update
   - Handle loading and error states
   - Rollback on API error

4. **Create ModuleCard component** (`components/module-card.tsx`)
   - Display module name and description
   - Show status badge (Active/Inactive)
   - Render toggle switch
   - Disable switch for `alwaysActive` modules
   - Show dependency warning if applicable

5. **Create ModuleListWidget** (`components/module-list-widget.tsx`)
   - Fetch and display all modules
   - Handle loading/error states
   - Grid or list layout

6. **Update settings page** (`page.tsx`)
   - Import and render ModuleListWidget
   - Remove static module list (lines 311-323)
   - Maintain existing page layout

## Success Criteria

- [ ] ModuleListWidget renders all 5 modules
- [ ] Core module shows as active with disabled toggle
- [ ] Toggling a module updates UI optimistically
- [ ] API error rolls back the UI state
- [ ] Loading states display during fetch
- [ ] Errors are user-friendly messages
- [ ] Styling matches existing settings page

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Switch component not available | Use existing @base-ui/react/switch or create custom toggle |
| Optimistic update complexity | Keep it simple: mutate array, rollback on error |
| Styling inconsistencies | Match existing card patterns in settings page |

## Notes

- Use existing `getAuthHeaders()` utility for auth
- Leverage existing API patterns from other features
- Keep component structure shallow for simplicity