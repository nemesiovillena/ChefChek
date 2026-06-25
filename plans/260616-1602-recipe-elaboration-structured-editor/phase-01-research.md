---
phase: 1
title: "Research"
status: pending
priority: P1
effort: "1h"
dependencies: []
---

# Phase 1: Research

## Overview
Analyze current codebase to map all elaboration touchpoints and confirm technical approach.

## Current State Analysis

### Elaboration field today
- **Prisma schema**: `elaboration String?` on `Recipe` model — stored as TipTap JSON string
- **Backend validation**: `recipes.service.ts:38` — parses as JSON, throws `BadRequestException` if invalid
- **Frontend editor**: Raw `<textarea>` in `recipes/page.tsx:565-575` — placeholder shows `{"type":"doc","content":[...]}`
- **TipTap component**: Exists at `components/tiptap-editor.tsx` with StarterKit, Underline, TextAlign, ListItem — NOT currently used in recipes page
- **PDF generation**: `technical-sheets.service.ts:537-548` — `parsePreparationSteps()` splits by `\n`, no structure

### PDF reference format (brownie.pdf)
Each elaboration step has 4 attributes:
1. **description** (required) — "forrar el molde con aluminio y untar con margarina"
2. **equipment** (optional) — tag on the right: "molde", "thermomix", "horno", "mezclar"
3. **time** (optional) — "3'", "4'", "20'"
4. **temperature** (optional) — "60º", "180º"

Plus separate sections:
- **Ingredientes** — already handled by `RecipeIngredient` relation
- **Notas** — NOT in current schema, needs adding

## Architecture Decision

### New elaboration JSON schema
```json
{
  "steps": [
    {
      "description": "forrar el molde con aluminio y untar con margarina",
      "equipment": "molde",
      "time": null,
      "temperature": null
    },
    {
      "description": "echar el chocolate en la thermomix y poner a velocidad 10",
      "equipment": "thermomix",
      "time": "3'",
      "temperature": null
    },
    {
      "description": "agregar la margarina y derretirlo",
      "equipment": "thermomix",
      "time": "4'",
      "temperature": "60º"
    }
  ]
}
```

### Why not keep TipTap?
- TipTap stores rich text (headings, bold, lists) — overkill for step-by-step instructions
- Parsing TipTap JSON for PDF is fragile and complex
- Structured steps are easier to validate, render, and print
- The description field within each step CAN use a mini TipTap editor for formatting (bold, italic) if needed later

### Equipment options (predefined + custom)
Common equipment in professional kitchens:
- molde, horno, thermomix, mezclar, batidora, sartén, olla, varillas, espátula, manga pastelera, abatidor, estufa, freidora, vaporero, griddle, salamandra, microondas

## Related Code Files
- Modify: `backend/prisma/schema.prisma` — add `notes` field to Recipe
- Modify: `backend/src/modules/recipes/recipes.service.ts` — new elaboration validation
- Modify: `backend/src/modules/recipes/dto/create-recipe.dto.ts` — update DTO
- Modify: `backend/src/modules/technical-sheets/technical-sheets.service.ts` — parse structured steps
- Modify: `frontend/src/app/dashboard/recipes/page.tsx` — replace textarea with step editor
- Modify: `frontend/src/hooks/use-recipes.ts` — update types
- Create: `frontend/src/app/dashboard/recipes/components/elaboration-step-editor.tsx`
- Create: `frontend/src/app/dashboard/recipes/components/recipe-print-view.tsx`

## Success Criteria
- [ ] All elaboration touchpoints identified and documented
- [ ] JSON schema for structured steps validated
- [ ] Equipment list defined
- [ ] Migration strategy for existing data confirmed
