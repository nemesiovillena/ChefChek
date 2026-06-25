---
phase: 2
title: "Backend Schema & DTOs"
status: pending
priority: P1
effort: "2h"
dependencies: [1]
---

# Phase 2: Backend Schema & DTOs

## Overview
Add `notes` field to Recipe model, update elaboration validation to accept structured step JSON, update DTOs and migration.

## Requirements
- Add `notes String?` field to Recipe model in Prisma schema
- Validate new elaboration JSON schema: `{ steps: [{ description, equipment?, time?, temperature? }] }`
- Backward compatible: old TipTap JSON still stored, but new format preferred
- Update `CreateRecipeDto` to accept structured steps
- Update `parsePreparationSteps()` in technical-sheets to read structured format

## Architecture

### Elaboration JSON schema (validated in DTO)
```typescript
interface ElaborationStep {
  description: string;      // required, min 1 char
  equipment?: string | null; // optional tag
  time?: string | null;     // optional, e.g. "3'", "20 minutos"
  temperature?: string | null; // optional, e.g. "60º", "180ºC"
}

interface ElaborationData {
  steps: ElaborationStep[];
}
```

### Equipment validation
- Predefined list for suggestions (not enforced — allow free text)
- Stored as plain string per step

## Related Code Files
- Modify: `backend/prisma/schema.prisma` — add `notes` field
- Modify: `backend/src/modules/recipes/dto/create-recipe.dto.ts` — new elaboration + notes fields
- Modify: `backend/src/modules/recipes/recipes.service.ts` — update validation logic
- Modify: `backend/src/modules/recipes/dto/recipe-response.dto.ts` — include notes
- Modify: `backend/src/modules/technical-sheets/technical-sheets.service.ts` — parse structured steps for PDF
- Create: migration file via `npx prisma migrate dev`

## Implementation Steps
1. Add `notes String?` to Recipe in `schema.prisma`
2. Run `bunx prisma migrate dev --name add-recipe-notes`
3. Update `CreateRecipeDto` — add `notes?: string`, change `elaboration` validation to accept structured JSON
4. Update `RecipesService.create()` — validate elaboration against new schema
5. Update `RecipesService.update()` — same validation
6. Update `RecipeResponse` DTO — add `notes` field
7. Update `parsePreparationSteps()` in technical-sheets — parse `{ steps: [...] }` format, fall back to `\n` split for legacy data
8. Run `bun run build` to verify compilation

## Success Criteria
- [ ] `notes` field added to Recipe model with migration
- [ ] `elaboration` validates structured step JSON
- [ ] Legacy TipTap JSON still accepted (no data loss)
- [ ] `parsePreparationSteps()` handles both old and new format
- [ ] Backend compiles without errors

## Risk Assessment
- **Legacy data**: Existing recipes with TipTap JSON — handled by fallback in `parsePreparationSteps()`
- **Breaking change**: Frontend must send new format — coordinate with Phase 3
