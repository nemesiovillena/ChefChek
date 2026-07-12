---
plan: recetas-duplicate-name-check
title: "Recetas: aviso advisory de duplicados por nombre"
status: pending
created: 2026-07-10
branch: develop
depends_on: []
blockedBy: []
---

# Recetas: aviso advisory de duplicados por nombre

## Objetivo
Replicar en **Recetas** el mismo sistema de detección advisory de duplicados por nombre ya implementado en **Artículos** (commit `4f7cc87`): al crear/editar una receta, aviso (no bloqueante) si ya existe una con nombre similar, ignorando mayúsculas/espacios/acentos.

## Patrón canónico (no re-explicar aquí)
Fuente de verdad: `plans/260710-2045-articulos-duplicate-name-check/` y el commit `4f7cc87`. **Este plan es una réplica** — la lógica, decisiones y gotchas son idénticos; solo cambian la tabla/entidad (`recipes`), el controlador y el punto de inserción del frontend.

## Decisiones (heredadas de artículos, ya acordadas con el usuario)
- **Advisory-only**: el backend NO bloquea (sin 409, sin índice). `create`/`update` intactos.
- **Matching**: `exacto + contiene` (strpos bidireccional) + accent-folding (`translate(lower(trim()))`, sin extensión).
- **`excludeId`** al editar (excluye la propia receta).
- Muestra recetas **inactivas** etiquetadas `(inactivo)`; excluye solo papelera (`deletedAt IS NULL`).
- Hook con patrón **`useCallback` + `setTimeout`** (todo setState dentro del callback, nunca síncrono en el effect) → cumple la regla de lint `react-hooks/set-state-in-effect`.

## Fases
- `phase-01-backend-check-name.md` — endpoint `GET /api/v1/recipes/check-name`
- `phase-02-frontend-advisory-banner.md` — hook `useRecipeNameCheck` + banner inline en `recipes/page.tsx`

## Criterios de aceptación
1. Al escribir un nombre de receta que ya existe (o está contenido / difiere en acentos/mayúsculas) → aviso en el modal.
2. No bloquea Guardar.
3. Al editar, no avisa de sí misma (`excludeId`).
4. `create`/`update`/`duplicate` de recetas intactos (duplicados permitidos por API).
5. Build backend + typecheck frontend OK; eslint pasa (pre-commit hook).

## Touchpoints (del scout)
- `backend/src/modules/recipes/recipes.service.ts` — añadir import `Prisma` + `findNameMatches` (no toca create/update).
- `backend/src/modules/recipes/recipes.controller.ts` — ruta `@Get("check-name")` antes de `@Get(":id")` (l.89).
- `frontend/src/hooks/use-recipe-name-check.ts` — **nuevo** (clon de `use-product-name-check.ts`).
- `frontend/src/app/dashboard/recipes/page.tsx` — banner tras el input nombre del formulario (l.~770); **no** confundir con el filtro de búsqueda (l.489).

## Cross-plan scan
- `260616-1602-recipe-elaboration-structured-editor` — sin solape (otra feature). No hay dependencia.

## Riesgos / rollback
- Cambio aditivo, sin migración, sin datos. Rollback = revertir 3-4 archivos.
- Gotchas: orden de rutas (`check-name` antes de `:id`), import `Prisma` ausente en el service, regla de lint del hook, y que el formulario es **inline** en un `page.tsx` grande (inserción cuidadosa en l.~770, no en el filtro).
