---
phase: 4
title: "Print/PDF Output"
status: pending
priority: P1
effort: "3h"
dependencies: [3]
---

# Phase 4: Print/PDF Output

## Overview
Update the technical-sheets PDF generation and add a print view that renders the recipe exactly like the brownie.pdf reference format — steps with equipment tags, ingredients list, notes.

## Requirements
- Print view component matching brownie.pdf layout
- Steps displayed with description on left, equipment tag on right
- Time/temperature inline with description
- Ingredients list below steps
- Notes section at bottom
- Browser print (window.print()) for quick printing
- PDF generation via existing technical-sheets service updated for structured format

## Architecture

### Print view layout (matching brownie.pdf)
```
┌─────────────────────────────────────────┐
│           [RECIPE NAME]                 │
│           [portions]                     │
│                                         │
│  1. forrar el molde con aluminio  molde │
│     y untar con margarina               │
│                                         │
│  2. echar el chocolate en la    thermo  │
│     thermomix, velocidad 10 3'  mix     │
│                                         │
│  3. agregar la margarina y      thermo  │
│     derretirlo a 60º 4'         mix     │
│                                         │
│  ...                                    │
│                                         │
│  Ingredientes:                          │
│  330 g chocolate negro                  │
│  480 g margarina                        │
│  ...                                    │
│                                         │
│  Notas:                                 │
│  Salen 28 und. Se corta 4x6.           │
└─────────────────────────────────────────┘
```

### PDF generation update
- `technical-sheets.service.ts:generatePreparation()` — read `steps[]` from structured JSON
- Each step renders: description (left), equipment tag (right-aligned)
- Time/temperature appended to description text with formatting
- Fallback for legacy TipTap JSON: extract text content, split by lines

## Related Code Files
- Create: `frontend/src/app/dashboard/recipes/components/recipe-print-view.tsx` — printable recipe view
- Modify: `backend/src/modules/technical-sheets/technical-sheets.service.ts` — update `generatePreparation()` and `parsePreparationSteps()`
- Modify: `frontend/src/app/dashboard/recipes/page.tsx` — add print button + trigger

## Implementation Steps
1. Create `recipe-print-view.tsx` — standalone printable component matching brownie.pdf layout
   - Title + portions header
   - Steps table: description left, equipment tag right
   - Time/temperature formatted inline (e.g. "a 60º 4'")
   - Ingredients list
   - Notes section
2. Add print button to recipe list (or detail view)
3. On click: open print view in new window or dialog, trigger `window.print()`
4. Update `parsePreparationSteps()` — parse `{ steps: [...] }`, extract description/equipment/time/temp
5. Update `generatePreparation()` in technical-sheets — render steps with equipment column, right-aligned
6. Style print view with `@media print` CSS to hide navigation, format for A4

## Success Criteria
- [ ] Print view matches brownie.pdf layout
- [ ] Equipment tags appear right-aligned beside each step
- [ ] Time/temperature shown inline in step description
- [ ] Ingredients and notes sections rendered
- [ ] `window.print()` produces clean A4 output
- [ ] PDF generation (technical-sheets) updated for structured format
- [ ] Legacy TipTap JSON still renders (fallback)

## Risk Assessment
- **Print CSS**: Browser print rendering varies — test in Chrome/Safari
- **A4 layout**: Long recipes may overflow — add page-break rules
