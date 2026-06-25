---
phase: 3
title: "Frontend Elaboration Editor"
status: pending
priority: P1
effort: "4h"
dependencies: [2]
---

# Phase 3: Frontend Elaboration Editor

## Overview
Replace the raw JSON textarea with a structured step-by-step editor. Each step has description, equipment tag, time, temperature. Add notes field. Include a live preview that matches the print format.

## Requirements
- Step-based editor with add/remove/reorder steps
- Each step: description (textarea), equipment (combobox with predefined + custom), time (input), temperature (input)
- Notes field (textarea)
- Live preview panel showing recipe as it will print
- Drag-and-drop step reordering
- Update `use-recipes.ts` types to match new schema

## Architecture

### Component structure
```
recipes/page.tsx
  └── Create/Edit Modal
        ├── Existing recipe fields (name, description, portions...)
        ├── ElaborationStepEditor (new)
        │     ├── StepRow (repeatable)
        │     │     ├── Step number badge
        │     │     ├── Description textarea
        │     │     ├── Equipment combobox (predefined + custom)
        │     │     ├── Time input
        │     │     └── Temperature input
        │     └── Add step button
        ├── Notes textarea (new)
        └── Submit button
```

### Equipment predefined options
```typescript
const EQUIPMENT_OPTIONS = [
  'molde', 'horno', 'thermomix', 'mezclar', 'batidora',
  'sartén', 'olla', 'varillas', 'espátula', 'manga pastelera',
  'abatidor', 'estufa', 'freidora', 'vaporero', 'griddle',
  'salamandra', 'microondas', 'cámara', 'marmita', 'turmix',
];
```

### Data flow
- `formData.elaboration` stores the JSON string: `JSON.stringify({ steps: [...] })`
- `formData.notes` stores plain text
- On submit, both sent to backend as-is

## Related Code Files
- Modify: `frontend/src/app/dashboard/recipes/page.tsx` — replace textarea with step editor + notes
- Modify: `frontend/src/hooks/use-recipes.ts` — add `notes` to Recipe type, update CreateRecipeData
- Create: `frontend/src/app/dashboard/recipes/components/elaboration-step-editor.tsx` — main step editor
- Create: `frontend/src/app/dashboard/recipes/components/step-row.tsx` — individual step row
- Create: `frontend/src/app/dashboard/recipes/components/equipment-combobox.tsx` — equipment selector
- Reuse: `frontend/src/app/dashboard/recipes/components/product-combobox.tsx` — pattern reference

## Implementation Steps
1. Add `notes` to `Recipe` and `CreateRecipeData` interfaces in `use-recipes.ts`
2. Create `equipment-combobox.tsx` — combobox with predefined equipment + free text custom entries
3. Create `step-row.tsx` — individual step row with description, equipment, time, temperature, remove button
4. Create `elaboration-step-editor.tsx` — manages array of steps, add/remove/reorder, serialization to JSON
5. Update `recipes/page.tsx` — replace elaboration textarea + add notes field, integrate new components
6. Update `handleEdit()` — parse structured JSON back into step array
7. Update `handleSubmit()` — serialize steps to JSON string
8. Test form creation and editing flow

## Success Criteria
- [ ] Can add/edit/remove steps with all fields
- [ ] Equipment combobox shows predefined + accepts custom text
- [ ] Steps can be reordered (drag or up/down buttons)
- [ ] Notes field present and saved
- [ ] Editing existing recipe populates step editor from JSON
- [ ] Form submission sends correct JSON structure
- [ ] UI matches app design language (shadcn + Tailwind)

## Risk Assessment
- **Complexity**: Step reordering adds complexity — start with up/down buttons, add dnd later if needed
- **Data migration**: Old recipes with TipTap JSON need fallback display — show raw text in a single step
