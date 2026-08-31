# Impl — Peso total elaborado / rendimiento de receta

Rama: `feat/recipe-yield-weight-anchor` (base develop). Fecha: 2026-08-31.

## Qué se hizo

Nuevo campo `Recipe.totalYieldWeight` (peso total elaborado, g) como ancla de
rendimiento. Invariante `totalYieldWeight = portions × portionSize`. `portions`
pasa a `Float` (raciones decimales).

### Fase 1 — Migración
- `schema.prisma`: `portions Int→Float`, `+ totalYieldWeight Float?`.
- Migración `20260831095709_recipe_yield_weight_and_decimal_portions/migration.sql`
  (ALTER type + ADD COLUMN + backfill `totalYieldWeight = portions × portionSize`).
- Dev DB (`localhost:5432`, sin `_prisma_migrations` → gestionada con `db push`):
  aplicado `prisma db push` + backfill manual SQL. 4 recetas, 0 NULL restantes.
  El fichero de migración queda para prod (Dokploy `migrate deploy`).

### Fase 2 — Backend
- `create-recipe.dto.ts`: `portions` `@Min(1)→@Min(0.01)`; `+ totalYieldWeight?` `@Min(0)`.
- `recipes.service.ts`:
  - `resolveYield()` privado: si llega `totalYieldWeight>0` es el ancla
    (`portionSize = total / portions`); si no, se deriva de `portions × portionSize`.
  - `create()` y `update()` lo usan; persisten el trío coherente.
  - `update()`: `totalYieldWeight` explícito → ancla; solo `portionSize` (cliente
    legacy) → recalcula total; nada tocado → conserva valores.
  - Duplicar receta copia `totalYieldWeight`. `formatRecipeResponse` lo expone.
- `recipe-response.dto.ts`: `+ totalYieldWeight?: number | null`.
- Sin cambios en escandallos/menus/categories (leen `portions` en divisiones; Float transparente).
- `computeCostPerYieldUnit`, `costPerPortion`, pricing: **intactos**. Cero deriva por
  construcción (backfill = valores previos).

### Fase 3 — Frontend
- `use-recipes.ts`: `+ totalYieldWeight` en `Recipe` y `CreateRecipeData`.
- `recipes/page.tsx`:
  - Constante `EMPTY_RECIPE_FORM` (reemplaza 4 bloques de reset duplicados).
  - Helpers `parsePositive`, `round2`, `fmtYield`, `sanitizeDecimal`.
  - `handleYieldChange(field, raw)`: 3 campos enlazados. Regla "Raciones manda":
    editar peso total → recalcula peso ración (raciones fijas); editar raciones o
    peso ración → recalcula el otro (peso total fijo).
  - Grid pasa a 3 columnas: **Peso total elaborado · Raciones · Peso Ración** +
    texto de ayuda.
  - Submit: `parseInt`→`parsePositive`, sin coerción `0→250`; envía el trío coherente.
  - Edit: prefill `totalYieldWeight` (fallback `portions × portionSize`).
  - Listado: `{fmtYield(portions)} ({fmtYield(portionSize)} g)`.
  - `recipe-visual-view.tsx`: raciones/gramos con ≤2 decimales.

### Fase 4 — Tests
- `recipes.service.spec.ts`: `mockRecipe.totalYieldWeight = 800` + bloque
  "rendimiento" (4 casos: create con/sin ancla, update recalcula peso ración,
  update acepta `portions: 2.5`).

## Verificación
- Backend: `jest` 118 suites / **1806 tests verdes**. `nest build` OK.
- Frontend: `tsc --noEmit` OK, `eslint` OK, `next build` OK.
- DB dev: backfill verificado (`portions*portionSize == totalYieldWeight` en las 4).

## Formato raciones decimales
`fmtYield`: hasta 2 decimales, sin ceros de relleno (`3.5`, `4`). Aplicado en
listado y ficha visual. PDF de ficha técnica no tocado (usa `recipe.yield` /
`recipe.portionWeight`, campos inexistentes — ya roto con fallbacks, fuera de alcance).

## Post-review (2026-08-31)
Tras code-review (DONE_WITH_CONCERNS → DONE, ver
`code-reviewer-260831-1208-recipe-yield-weight-review-report.md`):
- **M1**: `update()` rama sin-ancla ahora cubre `portionSize != null || portions != null`
  → PATCH parcial conserva peso ración, recalcula peso total. Sin cambio de contrato.
- **M2** (decisión del usuario: "redondea"): al editar peso ración, raciones se
  redondean a entero (`Math.round`, mín 1) y el peso total se reajusta a
  `raciones × pesoRación`. Raciones tecleadas directamente siguen admitiendo decimales.
- Tests: +3 (PATCH solo-portionSize, PATCH solo-portions, renombrar conserva
  coste+rendimiento). Backend **1809 tests verdes**. Frontend tsc+eslint+build OK.
- `docs/recipe-data-model.md` actualizado con las 3 reglas.

## Pendiente / no incluido
- No probado contra la app en vivo (worktree sin dev server; :3000 corre del
  checkout principal — ver [[dev-server-3000-runs-from-main-checkout]]).
- `docs/recipe-data-model.md` y `docs/database-schema.md` actualizados.
- Commit / PR: no hechos (esperan al usuario).

## Preguntas abiertas
- Ninguna. Formato `fmtYield` asumido (≤2 decimales); ajustable si el usuario prefiere otro.
