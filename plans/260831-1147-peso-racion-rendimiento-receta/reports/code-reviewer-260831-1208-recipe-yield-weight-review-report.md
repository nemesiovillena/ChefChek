# Code Review — Recipe totalYieldWeight anchor + decimal portions

Branch: `feat/recipe-yield-weight-anchor` (uncommitted working tree)
Date: 2026-08-31
Reviewer: code-reviewer

## Scope
- `backend/prisma/schema.prisma` (Recipe.portions Int→Float, +totalYieldWeight Float?)
- `backend/prisma/migrations/20260831095709_recipe_yield_weight_and_decimal_portions/migration.sql`
- `backend/src/modules/recipes/recipes.service.ts` (resolveYield, create, update, duplicate, formatRecipeResponse)
- `backend/src/modules/recipes/dto/{create-recipe,recipe-response}.dto.ts`
- `backend/src/modules/recipes/recipes.service.spec.ts` (+4 cases)
- `frontend/src/app/dashboard/recipes/page.tsx` (linked yield trio)
- `frontend/src/app/dashboard/recipes/components/recipe-visual-view.tsx`
- `frontend/src/hooks/use-recipes.ts`
- docs: `database-schema.md`, `recipe-data-model.md`
- LOC: ~275 changed

## Build / Test Results (all green)
- `bunx jest recipes escandallos menus` → 6 suites, 104 tests passed
- `bun run build` (backend, `nest build`) → success
- `bunx tsc --noEmit` (frontend) → clean
- `bunx eslint` on 3 changed frontend files → clean

## Overall Assessment
Well-scoped, coherent change. The anchor invariant (`totalYieldWeight = portions × portionSize`)
is enforced server-side in `resolveYield()` and mirrored in the frontend trio logic.
No critical defects. Cost/pricing is unchanged for un-edited recipes and for the
normal frontend edit path (verified by trace, see below). Remaining items are a
legacy-API behavior change, frontend rounding drift inherent to the 3-linked-field
design, and thin test coverage on the legacy branches.

## Critical Issues
None.

## High Priority
None.

## Medium Priority

### M1 — Legacy API client sending only `portions` on PATCH silently changes portionSize + totalCostPerUnit
`recipes.service.ts` `update()` `effectiveTotalYieldWeight`:
```
dto.totalYieldWeight != null ? dto.totalYieldWeight
  : dto.portionSize != null ? null                 // recompute total from portions×portionSize
  : recipe.totalYieldWeight                          // keep stored anchor
```
If a client sends `{ portions: 6 }` only (no portionSize, no totalYieldWeight), the
stored `totalYieldWeight` becomes the anchor, so `portionSize` is recomputed as
`totalYieldWeight / 6` and `totalCostPerUnit` changes (`totalCost / totalYieldWeight`
instead of the old `totalCost / (6 × oldPortionSize)`). Pre-change behavior kept the
old portionSize.
- Impact: real only for external/legacy API callers. The app frontend always posts
  the full reconciled trio, and the only other internal consumer
  (`ai-assistant/tools/recipe-cost.tool.ts`) is read-only. No import/scrape endpoint exists.
- This is arguably the intended new semantics ("total elaborado is the anchor"), but
  it is an undocumented contract change on `PATCH /recipes/:id`.
- Also note: `update()` takes `@Body() Partial<CreateRecipeDto>` — a TS type, not a
  class — so class-validator (`@Min(0.01)` portions, `@Min(0)` totalYieldWeight) does
  NOT run on PATCH. `resolveYield` is defensively guarded (`> 0` checks) so this is
  not exploitable, but the DTO constraints are illusory on update. Pre-existing.
- Recommendation: either document the anchor-wins behavior on the endpoint, or (if
  legacy parity matters) treat "portions changed but totalYieldWeight absent" the
  same as the portionSize-only branch (recompute total, keep portionSize).

### M2 — Frontend linked-field rounding drift; trio can be internally incoherent before submit
`handleYieldChange` in `page.tsx`:
- Editing peso ración with T=1000, P 250→300 gives `portions = round2(1000/300) = 3.33`;
  now `3.33 × 300 = 999 ≠ 1000`. On submit `totalYieldWeight` (1000) is sent verbatim
  and wins server-side, so persisted `portionSize` becomes `300.3`, not the 300 the
  user typed. Chef sees "3,33 raciones" / "300,3 g".
- If the raciones field is empty/0 while the user edits peso total, neither recompute
  branch fires (`T>0 && R>0` false), leaving a stale `portionSize` shown; server then
  self-heals to `portions = 1`. The form display is misleading in that window.
- `round2` is applied to `portions` (raciones) — a value most users think of as an
  integer — producing values like `3.33`.
- These follow from the product rule stated in the task ("editing raciones OR peso
  ración recomputes the other"), so not a bug to reverse. Suggest: snap `portions` to
  a cleaner precision, or show a small "≈" hint when the trio doesn't multiply out
  exactly, or block submit when a required field (raciones) is empty rather than
  coercing to 1.

## Low Priority

### L1 — Backfill produces nonsense weights for recipes that never set portionSize
Migration `UPDATE recipes SET totalYieldWeight = portions * portionSize`. Recipes that
relied on the `portionSize` default of `1` get `totalYieldWeight = portions` (e.g. 4 g).
Mathematically consistent with the invariant and prior data, but the UI will show a
tiny "peso total elaborado". Users can correct per recipe. Consider a one-line note in
the plan / release notes. No code fix needed.

### L2 — Migration does a full-table rewrite + full-table UPDATE under ACCESS EXCLUSIVE
`ALTER COLUMN "portions" SET DATA TYPE DOUBLE PRECISION` rewrites the table and the
trailing `UPDATE` touches every row, all in Prisma's migration transaction. `recipes`
is small (single-restaurant tenants), so lock time is negligible. No action; noted for
completeness.

### L3 — Prisma `ALTER COLUMN "portions" SET DEFAULT 1` (migrate-diff drift)
Expected and harmless. `SET DATA TYPE` already casts the existing `DEFAULT 1`; Prisma
emits the explicit `SET DEFAULT` defensively. Float `@default(1)` renders as `1` and
Postgres casts to `1.0`. No concern.

### L4 — `recipe-visual-view.tsx` `recipe.portions.toFixed(2)`
Type-safe (`Recipe.portions: number`, required) and API always populates it. Was
`{recipe.portions}` (null-tolerant) before; now would throw if `portions` were ever
undefined at runtime. Not currently reachable. Leave as is.

## Edge Cases Checked (no defect)
- `resolveYield` division-by-zero: guarded (`portions > 0 ? : 1`, `totalYieldWeight > 0`).
- `computeCostPerYieldUnit` zero yield: guarded, falls back to `totalCost / portions`.
- Un-edited recipe edited via frontend for a non-yield reason (rename): trio round-trips
  identically (`totalYieldWeight` backfilled = `portions × portionSize`, anchor recomputes
  same `portionSize`), so `costPerPortion`, `totalCostPerUnit`, `theoreticalSellingPrice`
  are byte-identical. No pricing regression.
- Version bump: still only on `name || ingredients || subRecipes`; yield-only edits do
  not bump. (Frontend always sends `name`, so every frontend save bumps — pre-existing.)
- `duplicate()`: passes `totalYieldWeight ?? undefined` into `create()`; original trio is
  coherent so `portionSize` is recomputed to the same value. `version` resets to 1. OK.
- `portions` Int→Float blast radius:
  - `escandallos.service.ts` — only divides by `recipe.portions` / `recipe.portionSize`; float-safe.
  - `menus.service.ts` — uses `menu.portions` (Menu model, untouched) and `recipe.totalCost`;
    does NOT read `recipe.portions`. Unaffected.
  - `categories.service.ts` — selects `portions` for display pass-through only.
  - `technical-sheets` — uses its own `recipe.yield` / `recipe.portionWeight` DTO fields, not
    `Recipe.portions`. Unaffected.
  - `ai-assistant/tools/recipe-cost.tool.ts` — read-only (`calculateRecipeCost`, `findNameMatches`).
  - No `Math.round`/`%`/`parseInt` on recipe portions anywhere in backend; frontend `parseInt`
    on portions was removed.
  - Frontend: no other `.portions` / `portionSize` consumers outside the 3 changed files.

## Tests
New spec cases assert the persisted trio via `recipe.{create,update}` mock args — meaningful,
not phantom. `mockRecipe` updated to a coherent trio (4 × 200 = 800).
Coverage gaps:
- No case for the `update()` legacy branches: portionSize-only (effective = null path) and
  portions-only (M1, the behavior change).
- No case asserting an un-edited recipe's `totalCostPerUnit` / `costPerPortion` is unchanged
  after a non-yield update.
- No case asserting version is NOT bumped on a yield-only update.

## Metrics
- Type coverage: frontend `tsc --noEmit` clean; backend `nest build` clean.
- Test coverage: recipes/escandallos/menus suites green (104 tests); +4 new recipe cases.
- Lint: 0 issues on changed frontend files.

## Recommended Actions
1. (M1) Decide and document `PATCH /recipes/:id` yield semantics; optionally align the
   portions-only case with the portionSize-only branch. Add spec cases for both legacy branches.
2. (M2) Guard the frontend trio: block submit when raciones is empty, and/or surface an
   "≈" hint when `R × P ≠ T` after rounding.
3. (L1) Add a release note that legacy recipes without a real `portionSize` will show a
   tiny "peso total elaborado" until re-saved.
4. Add a spec asserting cost fields are unchanged for a non-yield update of a pre-existing recipe.

## Unresolved Questions
1. Is the `PATCH` "totalYieldWeight is the anchor even when only `portions` changes"
   behavior intentional, or should legacy parity (keep `portionSize`) be preserved?
2. Product intent for fractional `portions` display — is `3,33 raciones` acceptable to
   show chefs, or should raciones snap to a coarser step when derived from peso ración?
3. Any external/integration API consumer of `PATCH /recipes/:id` outside this repo that
   sends partial yield fields?

## Resolución (post-review, 2026-08-31)

- **M1 — RESUELTO.** `update()` `effectiveTotalYieldWeight`: la rama sin ancla ahora
  cubre `portionSize != null || portions != null`. Un PATCH con solo `{portions: N}`
  conserva el peso ración y recalcula el peso total (`N × portionSize`), igual que la
  rama de solo-portionSize. Sin cambio de contrato para clientes legacy. La ilusión de
  `@Min()` en PATCH (`Partial<CreateRecipeDto>` es tipo, no clase) es preexistente y
  `resolveYield` está guardado con `> 0`; no se toca.
- **Tests — AÑADIDOS.** 3 casos nuevos: PATCH solo-portionSize, PATCH solo-portions,
  update ajeno al rendimiento (renombrar) conserva coste + rendimiento. Backend 1809
  tests verdes.
- **M2 — RESUELTO.** El usuario pidió redondear. `handleYieldChange`: al editar peso
  ración, `portions = Math.round(pesoTotal / pesoRación)` (mín. 1) y el peso total se
  reajusta a `raciones × pesoRación`; el peso ración se respeta tal cual. Raciones
  directas siguen admitiendo decimales. Trio siempre coherente antes de submit.
  Input `required` bloquea submit vacío.
- **L1 — NOTA, sin código.** `totalYieldWeight = portions × portionSize` es exactamente
  el valor que `computeCostPerYieldUnit` ya usaba de forma implícita, así que no
  introduce datos peores que los existentes. Recetas con `portionSize` por defecto (1)
  mostrarán un peso total pequeño hasta que se reguarden; se corrige por receta.
- **L2/L3/L4 — sin acción** (confirmados no-issues).

Status: DONE — M1, M2 y tests resueltos. L1 = nota de release. Sin bloqueos.

---

Status original: DONE_WITH_CONCERNS
Summary: No critical or high issues; build and tests are green and un-edited recipes keep
identical costing. Concerns are an undocumented PATCH contract change for partial-yield
legacy clients (M1), frontend rounding drift in the linked trio (M2), and missing spec
coverage on the legacy update branches.
