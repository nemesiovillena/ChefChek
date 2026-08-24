---
phase: 3
title: Frontend modal y tipos
status: completed
priority: P1
dependencies:
  - 2
---

# Phase 3: Frontend modal y tipos

## Overview

Reescribir `order-create-dialog.tsx` como un único formulario: `título` (obligatorio) + selector de receta opcional (solo vínculo, sin disparar cálculo de ingredientes/coste) + `notas` + `tiempo estimado`. Actualizar tipos en `use-production.ts` y el punto de visualización que muestra `recipeName`.

## Requirements

- Funcional: crear una orden sin receta, con solo título + tiempo estimado.
- Funcional: crear una orden con receta vinculada (referencia, sin cálculo de ingredientes ni coste).
- No dos modos/toggle — un solo formulario con la receta como campo opcional más (decisión ya tomada con el usuario en la consulta de arquitectura previa).

## Architecture

`order-create-dialog.tsx` actual: obliga receta (`canSubmit` exige `recipeId !== ''`), llama a `GET /v1/recipes/:id/calculate` al seleccionar, calcula y muestra ingredientes con disponibilidad de stock, bloquea el submit si algún ingrediente falta.

Nuevo comportamiento:
- `handleSelectRecipe` ya no llama a `/recipes/:id/calculate` ni construye `ingredients` — solo guarda `recipeId`/`recipeName` para enviarlos como referencia.
- Se retira `checkIngredientsAvailability`, `IngredientRow`, el bloque de renderizado de ingredientes, y el import de `useRecipeCost`/`RecipeCost`/`Product`/`apiClient` si dejan de usarse (verificar).
- Nuevo campo `título` (input de texto, obligatorio) y `descripción` (textarea opcional, mapea al campo `description` nuevo del backend — distinto de `notes`, que no se toca en este plan, ver Validation Log Session 1 del plan).

<!-- Updated: Validation Session 1 - textarea mapea a `description`, no a `notes` -->
- `canSubmit` pasa a exigir solo `title.trim() !== '' && estimatedTime.trim() !== ''`.
- Verificado: `SubRecipeCombobox` (`frontend/src/app/dashboard/recipes/components/sub-recipe-combobox.tsx:16-61`) no tiene botón de limpiar — `onSelect` solo dispara al elegir un ítem. Pero su trigger ya renderiza el placeholder cuando `value`/`label` están vacíos (línea 51: `{value && label ? (...) : (<span>{placeholder}</span>)}`), así que basta con un botón "Quitar receta" externo en `order-create-dialog.tsx` que haga `setRecipeId(''); setRecipeName('')` — no requiere tocar el componente compartido (también usado en Recetas).

Tipos en `use-production.ts` (líneas ~40-77):
```typescript
export interface ProductionOrder {
  // ...
  recipeId?: string | null;
  recipeName?: string | null;
  title: string;
  quantity?: number | null;
  unit?: string | null;
  description?: string | null;
  // ... resto igual, "items" deja de tener uso real pero el campo puede quedarse en la interfaz como opcional si el backend lo sigue exponiendo
}

export interface CreateProductionOrderInput {
  batchId: string;
  title: string;
  recipeId?: string;
  recipeName?: string;
  quantity?: number;
  unit?: string;
  estimatedTime: number;
  description?: string;
}
```
`ProductionIngredientInput` se retira si no queda usado en ningún otro archivo (verificar con grep).

Punto de visualización: `batch-detail-panel.tsx:129` — `{order.recipeName}` → `{order.title}`.

## Related Code Files

- Modify: `frontend/src/app/dashboard/production/components/order-create-dialog.tsx` (reescritura completa del formulario)
- Modify: `frontend/src/hooks/use-production.ts` (tipos `ProductionOrder`, `CreateProductionOrderInput`; retirar `ProductionIngredientInput` si queda sin uso)
- Modify: `frontend/src/app/dashboard/production/components/batch-detail-panel.tsx` (línea 129, `recipeName` → `title`)

## Implementation Steps

1. Actualizar `use-production.ts`: aplicar los cambios de tipos descritos arriba.
2. Reescribir `order-create-dialog.tsx`:
   a. Quitar `checkIngredientsAvailability`, `IngredientRow`, `ConvertUnitsResponse`, el estado `ingredients`/`isLoadingIngredients`, y el bloque JSX de ingredientes.
   b. Añadir estado `title` y `description`.
   c. `handleSelectRecipe` solo setea `recipeId`/`recipeName` (sin llamada a `/calculate`).
   d. Añadir un botón "Quitar receta" (visible solo cuando `recipeId !== ''`) junto al combobox que haga `setRecipeId(''); setRecipeName('')` — confirmado que el combobox no necesita cambios, ya maneja el estado vacío correctamente vía su placeholder.
   e. `canSubmit = title.trim() !== '' && estimatedTime.trim() !== ''`.
   f. `handleSubmit` envía `{ batchId, title, recipeId: recipeId || undefined, recipeName: recipeName || undefined, quantity: quantity ? Number(quantity) : undefined, unit: unit || undefined, estimatedTime: Number(estimatedTime), description: description || undefined }`.
3. Actualizar `batch-detail-panel.tsx:129` para mostrar `order.title`.
4. `grep -rn "ProductionIngredientInput\|checkIngredientsAvailability" frontend/src` — si no queda ningún uso fuera del propio hook, retirar el tipo de `use-production.ts`.
5. Levantar el frontend (`bun dev` o el comando del proyecto) y probar en navegador: crear orden sin receta, crear orden con receta, verificar que el listado del lote muestra el título correcto en ambos casos.

## Success Criteria

- [x] Se puede crear una orden con solo título + tiempo estimado, sin tocar el selector de receta (verificado en navegador real con agent-browser).
- [x] Se puede vincular una receta sin que se dispare ninguna llamada a `/v1/recipes/:id/calculate` ni a `/v1/escandallos/convert-units`.
- [x] El listado de órdenes del lote muestra `title`, no `recipeName`.
- [x] `grep -rn "recipes/:id/calculate\|convert-units" frontend/src/app/dashboard/production/` no devuelve nada.
- [x] Verificación manual en navegador (no solo tipos/build) del flujo completo: login → abrir lote → crear orden sin receta → aparece en el listado; además botón "Quitar receta" probado (vincula→aparece botón→clic→vuelve al placeholder).

## Risk Assessment

Riesgo bajo, ya verificado: el combobox compartido no necesita modificarse (ver Architecture) — la deselección se resuelve enteramente en `order-create-dialog.tsx` sin tocar `sub-recipe-combobox.tsx`, así que no hay blast radius sobre el módulo Recetas.
