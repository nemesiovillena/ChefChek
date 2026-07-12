---
phase: 1
title: "Backend: endpoint GET /api/v1/recipes/check-name"
status: pending
priority: P2
dependencies: []
---

# Phase 1: Backend — endpoint GET /api/v1/recipes/check-name

## Overview
Añadir `findNameMatches` a `RecipesService` (clon del de productos sobre la tabla `recipes`) y exponerlo vía `GET /api/v1/recipes/check-name` antes de la ruta `:id`.

## Requirements
- Functional: dada una cadena `name`, devolver hasta 5 recetas del tenant cuyo nombre coincida (exacto o contenido, accent-insensitive), excluyendo papelera y opcionalmente un `excludeId`.
- Non-functional: SQL parametrizado (sin inyección), reusable, sin tocar `create`/`update`/`duplicate`.

## Architecture
Réplica exacta de `ProductsService.findNameMatches` (commit `4f7cc87`). SQL crudo vía `Prisma.sql` con CTE+subquery para normalizar una sola vez; match con `strpos(...) > 0` bidireccional; accent-folding con `translate(lower(trim()), FROM, TO)` donde FROM/TO = 16 chars minúsculos españoles.

## Related Code Files
- Modify: `backend/src/modules/recipes/recipes.service.ts` (+ import `Prisma`, + método `findNameMatches`)
- Modify: `backend/src/modules/recipes/recipes.controller.ts` (+ ruta `@Get("check-name")`)
- Reference (patrón): `backend/src/modules/products/products.service.ts:findNameMatches` y `products.controller.ts:checkName`

## Implementation Steps
1. En `recipes.service.ts`: añadir `import { Prisma } from "@prisma/client";` (NO está importado hoy).
2. Añadir constantes `ACCENTS_FROM = "áàäéèëíïóòöúùüñç"` / `ACCENTS_TO = "aaaeeeiiooouuunc"` y método `findNameMatches(tenantId, name, excludeId?)` idéntico al de productos, cambiando `products` → `recipes` (tabla `recipes`, columnas `id`, `name`, `"isActive"`, `"tenantId"`, `"deletedAt"`).
3. En `recipes.controller.ts`: añadir `@Get("check-name")` **antes** de `@Get(":id")` (l.89) — p.ej. justo después de `@Get("options")` (l.73). Firmar `checkName(@Query("name") name, @Query("excludeId") excludeId, @Req() req)` → `return { success: true, data: await service.findNameMatches(req.tenantId, (name||"").trim(), excludeId) }`. Usar los mismos roles/guards que las demás `@Get` del controlador.
4. Build: `cd backend && npm run build` (nest build) + `npx tsc --noEmit -p tsconfig.json` (0 errores).
5. Reiniciar el proceso `:3001` (corre desde `dist`).

## Success Criteria
- [ ] `GET /api/v1/recipes/check-name?name=<exacto>` devuelve la receta existente.
- [ ] Variantes (MAYÚSCULAS, acentos, espacios, nombre contenido) matchean; typo no.
- [ ] `excludeId=self` → vacío; gibberish/`<2` chars → vacío.
- [ ] Ruta devuelve 401 sin auth (no 404) → confirmación de que está antes de `:id`.
- [ ] `create`/`update`/`duplicate` sin cambios.

## Risk Assessment
- **Ruta capturada como `:id`** si se declara después → mitigación: declarar antes de l.89 (verificado en scout).
- **`Prisma` no importado** → compilación falla; mitigación: paso 1 (añadir import).
- **Cliente Prisma stale** tras tocar schema → `npx prisma generate` si el IDE muestra errores fantasma (tsc da 0).
