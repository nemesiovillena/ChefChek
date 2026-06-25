---
title: "Recipe Elaboration Structured Editor"
description: "Transform the raw JSON elaboration field into a structured step-based editor matching professional recipe ficha format (brownie.pdf reference)"
status: pending
priority: P1
branch: "develop"
tags: [recipes, elaboration, pdf, tipTap]
blockedBy: []
blocks: []
created: "2026-06-16T16:02:00Z"
createdBy: "ck:plan"
source: skill
---

# Recipe Elaboration Structured Editor

## Overview

Replace the raw JSON textarea for recipe elaboration with a structured step-based editor. Each step has: description, equipment/utensil, time, temperature. Output matches the professional ficha format shown in `brownie.pdf` — steps in a flow with equipment labels, ingredients list, and notes section.

## Reference Format (brownie.pdf)

```
Brownie 1 bandeja

  forrar el molde con aluminio y         molde
  untar con margarina

  echar el chocolate en la thermomix     thermomix
  y poner a velocidad 10 3'

  agregar la margarina                   thermomix
  y derretirlo a 60º 4'

  mezclar el azucar con los huevos e     mezclar
  incorporar a la thermomix

  agregar la harina tamizada,            mezclar
  el cacao, la sal y la levadura

  incorporar las nueces picadas          mezclar

  verter la masa en el molde             molde

  cocer al horno a 180º 20'             horno

  reposar y dejar enfriar               molde

Ingredientes:
330 g de chocolate negro
480 g margarina
...

Notas:
Salen 28 und.
Se corta 4x6. Se envasa de 4 und.
```

## Key Design Decisions

1. **Structured JSON over free-text** — elaboration stored as `{ steps: [{ description, equipment, time, temperature }] }` instead of TipTap doc
2. **Keep existing `elaboration` column** — same field, new JSON schema. Migration handles format conversion
3. **Reuse existing TipTap editor** — already at `frontend/src/components/tiptap-editor.tsx`, extend for step descriptions
4. **Add `notes` field** to Recipe model — separate from elaboration steps
5. **Equipment labels** — predefined list + custom free-text, shown as tags beside each step

## Phases

| Phase | Name | Status | Effort |
|-------|------|--------|--------|
| 1 | [Research](./phase-01-research.md) | Pending | 1h |
| 2 | [Backend Schema & DTOs](./phase-02-backend-schema-dtos.md) | Pending | 2h |
| 3 | [Frontend Elaboration Editor](./phase-03-frontend-elaboration-editor.md) | Pending | 4h |
| 4 | [Print/PDF Output](./phase-04-print-pdf-output.md) | Pending | 3h |
| 5 | [Integration & Testing](./phase-05-integration-testing.md) | Pending | 2h |

## Dependencies

- No cross-plan dependencies
- Phase 2 → Phase 3 (schema before UI)
- Phase 3 → Phase 4 (editor before print)
