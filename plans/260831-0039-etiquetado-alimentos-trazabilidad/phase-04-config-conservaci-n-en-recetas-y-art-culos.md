---
phase: 4
title: Config conservación en Recetas y Artículos
status: completed
priority: P2
effort: ~0.5 sesión
dependencies:
  - 1
---

# Phase 4: Config conservación en Recetas y Artículos

## Overview

Exponer y editar los campos de conservación/vida útil añadidos en la fase 1: DTOs + servicios + un fieldset en el modal de Receta y en el de Artículo. Independiente de las fases 2/3 (ficheros distintos) pero comparte modales con la fase 5 → integrar en fase 6.

## Requirements

- Funcional:
  - `Recipe` create/update acepta y persiste `shelfLifeDays`, `shelfLifeFrozenDays`, `storageCondition`, `storageTempMin`, `storageTempMax`.
  - `Product` create/update acepta y persiste `secondaryShelfLifeDays`, `shelfLifeFrozenDays`, `storageCondition`, `storageTempMin`, `storageTempMax`.
  - Los GET de receta y de artículo devuelven estos campos.
  - UI: fieldset "Conservación y vida útil" en ambos modales, con:
    - selector condición: Refrigerado / Congelado / Ambiente
    - rango °C (min/max) — opcional
    - días de vida útil (receta: "tras elaboración"; artículo: "tras apertura/manipulación")
    - días de vida útil congelado — opcional
- No funcional: todos los campos opcionales; no romper contratos existentes; `@Transform` numérico donde aplique (memoria `backend-validationpipe-no-coerces-numbers`).

## Architecture

### Backend

- `backend/src/modules/recipes/dto/*` — añadir campos opcionales a Create/Update DTO. `recipes.service.ts` — incluir en `data` de create/update y en el `select`/`include` de lectura.
- `backend/src/modules/products/dto/*` + `products.service.ts` — idem. **Ojo** memoria `bug-preexistente-unitsize-products-service` y `articulo-modal-stale-price-overwrites-preferred-offer`: seguir el patrón "sólo enviar si el usuario editó" del modal de artículo; aquí son campos nuevos sin ese acoplamiento, pero no reintroducir borrados incondicionales de `data.*`.
- Constante compartida de valores de `storageCondition` (`REFRIGERATED|FROZEN|AMBIENT`) — `backend/src/common/constants/` o dentro del módulo etiquetado y reexportada.

### Frontend

- Componente `ConservationFieldset` reutilizable (`frontend/src/features/etiquetado/components/conservation-fieldset.tsx` o en `components/`), usado por:
  - modal de Receta (`frontend/src/app/dashboard/recipes/...` — memoria `recipe-modal-three-tabs-m3`: añadir a una pestaña existente, p.ej. "Datos"/"General", **no** crear 4ª pestaña ni usar `<nav>`).
  - modal de Artículo (`frontend/src/app/dashboard/products/...` — añadir a la pestaña de datos generales).
- Tokens de color `var(--...)` sin `dark:` (convención del proyecto).
- `date`/number inputs: respetar `color-scheme` (memoria `dark-mode-date-inputs-color-scheme`) y suelo de 16px en móvil (memoria `ios-input-zoom-16px-floor`) — aquí son inputs numéricos/select, verificar igualmente.

## Related Code Files

- Modify: `backend/src/modules/recipes/dto/create-recipe.dto.ts`, `update-recipe.dto.ts`, `recipes.service.ts`, specs
- Modify: `backend/src/modules/products/dto/*.ts`, `products.service.ts`, specs
- Create: `frontend/src/features/etiquetado/components/conservation-fieldset.tsx`
- Modify: modal de Receta y modal de Artículo (form + tipos + hook de submit)
- Modify: tipos TS del cliente (`frontend/src/features/recipes/*`, `frontend/src/features/products/*`)

## Implementation Steps

1. Backend DTOs + service (recetas), spec: crear/leer con campos; crear/leer sin campos (nulls).
2. Backend DTOs + service (productos), spec.
3. `ConservationFieldset` con estado controlado + validación (min ≤ max, días ≥ 0).
4. Integrar en modal de Receta; mapear a payload de submit.
5. Integrar en modal de Artículo; mapear a payload.
6. `npx jest src/modules/recipes src/modules/products` verde; `tsc --noEmit` frontend verde.

## Success Criteria

- [ ] Crear/editar receta con conservación → persiste y se relee.
- [ ] Crear/editar artículo con conservación secundaria → persiste y se relee.
- [ ] Recetas/artículos sin esos datos siguen funcionando (campos `null`).
- [ ] Fieldset visible y funcional en ambos modales, sin romper el layout de pestañas.
- [ ] Specs backend + typecheck frontend verdes.

## Risk Assessment

- Modales de Receta/Artículo son grandes y con historial de bugs de estado (varias memorias) → cambios mínimos, no tocar la lógica de precio/coste; sólo añadir campos.
- Colisión con fase 5 si ambas editan el mismo modal → la fase 5 no toca los modales de Receta/Artículo (sólo añade botón "Etiquetar" en la **ficha/detalle**, fase 6); coordinar orden de merge.
