---
phase: 6
title: "Botones Etiquetar + pulido y docs"
status: pending
priority: P2
effort: "~0.5 sesión"
dependencies: [4, 5]
---

# Phase 6: Botones "Etiquetar" + pulido y docs

## Overview

Integración final: botón "Etiquetar" en la ficha/detalle de Receta y de Artículo (deep-link con entidad preseleccionada), coordinación del `ConservationFieldset` compartido entre fase 4 y 5, code review, docs.

## Requirements

- Funcional:
  - Ficha de **Receta** (detalle): botón "Etiquetar" → `/dashboard/etiquetado/nueva?recipeId=<id>` (tipo Elaborado preseleccionado, picker resuelto).
  - Ficha de **Artículo** (detalle): botón "Etiquetar" → `/dashboard/etiquetado/nueva?productId=<id>` (tipo Manipulado preseleccionado).
  - Ambos botones ocultos si el módulo `etiquetado` está desactivado o el rol no tiene `etiquetado.emit`.
  - `nueva/page.tsx` lee query params y salta el paso 1.
- No funcional: docs actualizadas; sin regresiones.

## Architecture

- Reutilizar el helper de "módulo activo" + "sección permitida" ya usado en frontend para condicionar botones.
- `ConservationFieldset`: un único componente en `frontend/src/features/etiquetado/components/` importado por los modales (fase 4) y por el wizard (fase 5). Verificar que no hay dos copias.
- Docs nuevas/actualizadas en `docs/`:
  - `docs/food-labeling-system.md` (nuevo): modelo de datos, flujos, formato de lote, presets de PDF, gating, decisiones y lo que queda fuera.
  - `docs/database-schema.md`: añadir `FoodLabel`, `FoodLabelIngredientLot`, columnas de conservación.
  - `docs/project-changelog.md` si el repo lo usa.
  - `docs/multi-tenancy-architecture.md` / doc de módulos: añadir `etiquetado` a la lista.
  - `docs/authorization-model.md`: sección `etiquetado` / `etiquetado.emit`.

## Related Code Files

- Modify: ficha de detalle de Receta (`frontend/src/app/dashboard/recipes/[id]/...` o el componente de detalle)
- Modify: ficha de detalle de Artículo
- Modify: `frontend/src/app/dashboard/etiquetado/nueva/page.tsx` (lectura de query params)
- Modify: `docs/*` según lista
- Create: `docs/food-labeling-system.md`

## Implementation Steps

1. Botón "Etiquetar" + gating en ficha de Receta.
2. Botón "Etiquetar" + gating en ficha de Artículo.
3. `nueva/page.tsx`: soporte `?recipeId=` / `?productId=` (skip paso 1, precargar `prep-context`).
4. Verificar `ConservationFieldset` único (no duplicado tras fases 4 y 5).
5. Code review con `code-reviewer` (alcance: módulo etiquetado + cambios en recipes/products + migración).
6. Docs.
7. Suite backend completa + `tsc --noEmit` backend y frontend verdes.
8. Journal (`/ck:journal`).

## Success Criteria

- [ ] "Etiquetar" en ficha de Receta abre el alta con la receta ya seleccionada (tipo Elaborado).
- [ ] "Etiquetar" en ficha de Artículo abre el alta con el artículo ya seleccionado (tipo Manipulado).
- [ ] Botones ocultos sin módulo / sin permiso.
- [ ] `ConservationFieldset` es un único componente compartido.
- [ ] `docs/food-labeling-system.md` creado; `database-schema.md` y doc de módulos actualizados.
- [ ] Code review sin hallazgos críticos abiertos; suite + typechecks verdes.

## Risk Assessment

- Deep-link con `prep-context` que falla si el módulo se desactiva entre navegación → manejar 403 con redirección al listado + toast.
- Merge entre fase 4 (modales) y fase 5 (wizard) tocando `ConservationFieldset` → crear el componente en la fase que se ejecute primero; la otra sólo lo importa.
