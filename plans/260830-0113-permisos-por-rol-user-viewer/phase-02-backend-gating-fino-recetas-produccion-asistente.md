---
phase: 2
title: 'Backend: gating fino (coste recetas, tareas producción, asistente IA)'
status: completed
priority: P1
dependencies:
  - 1
---

# Phase 2: Backend — gating fino

## Overview

Aplicar las sub-capacidades: bloquear coste/edición de recetas, permitir "completar tareas" con Producción oculta, sanear el Asistente IA y los KPIs del dashboard de importes € cuando el rol no puede ver costes.

## Requirements

- Funcional: USER sin `recipes.cost` ⇒ 403 en `GET /recipes/:id/calculate`; `POST /technical-sheets/generate {includeCosts:true}` ⇒ 403.
- Funcional: USER sin `recipes.edit` ⇒ 403 en `POST/PATCH/DELETE /recipes`, `POST /recipes/:id/duplicate`, `POST /recipes/upload-image`.
- Funcional: USER sin `recipes.ficha` ⇒ 403 en `POST /technical-sheets/generate` cuando NO es `recipeCardOnly`.
- Funcional: USER con `production=false` + `production.tasks=true` ⇒ puede `GET /production/orders/:id/tasks` (o el endpoint que alimenta la card), `GET /production/batches` para el board, y `PUT /production/orders/:orderId/complete`; NO puede `POST /production/batches` ni el resto.
- Funcional: `POST /technical-sheets/generate {recipeCardOnly:true}` funciona para un USER con `recipes` visible aunque `technical-sheets` esté oculto.
- Funcional: Asistente IA — con `recipes.cost=false`, las tools que devuelven € no se registran; `top-purchased-products` y `stock` responden sin campos monetarios; el system prompt avisa de que no hay acceso a costes.
- Funcional: `GET /dashboard/kpis` con `recipes.cost=false` omite (o pone a `null`) los campos de coste/margen; `GET /dashboard/metrics/*` y `alerts` de coste ⇒ 403 o payload saneado.
- No-funcional: sin config, comportamiento idéntico al actual.

## Architecture

### Recetas (`backend/src/modules/recipes/recipes.controller.ts`)

- Clase ya lleva `@RequireSection("recipes")` (Phase 1).
- Método `GET :id/calculate` → añadir `@RequireSection("recipes.cost")`.
- Métodos `POST`, `PATCH :id`, `POST :id/duplicate`, `POST upload-image`, `POST :id/duplicate-dismissals/...` → añadir `@RequireSection("recipes.edit")`.
  - `DELETE :id` ya es `@Roles("ADMIN")` → **omitir** `@RequireSection` (ADMIN siempre bypass; USER/VIEWER ya bloqueados por rol).
  - **Decisión validación #5**: `recipes.edit` solo tiene efecto real sobre USER. VIEWER ya está bloqueado en estos endpoints por `@Roles("ADMIN","USER")`. La columna VIEWER de la pantalla no ofrece este sub-check.
- `@RequireSection` de método **sustituye** al de clase (`getAllAndOverride` coge el más específico). Verificar que el guard hace OR entre las keys del método, no entre método y clase. → El USER debe seguir necesitando `recipes` visible: usar `@RequireSection("recipes","recipes.cost")` en `calculate`? No — si `recipes` está oculto no debería llegar aquí porque el resto de endpoints de la clase lo bloquean, pero `calculate` con override perdería el check de clase. **Decisión**: en el guard, evaluar SIEMPRE también la key de clase además de la de método (AND clase, OR dentro de método). Ajustar `SectionAccessGuard`: `classKeys` deben pasar Y `methodKeys` (OR) deben pasar.

> Ajuste a Phase 1: `SectionAccessGuard` lee metadata de clase y de método por separado (`reflector.get` en `ctx.getClass()` y `ctx.getHandler()`). Regla: (algún classKey permitido O sin classKeys) **Y** (algún methodKey permitido O sin methodKeys). Actualizar el spec de Phase 1 acorde.

### Ficha técnica / recipe-card (`technical-sheets.controller.ts`)

- Clase: `@RequireSection("technical-sheets","recipes")` (Phase 1) → pasa si el USER ve technical-sheets **o** recetas.
- `POST generate` / `POST generate-batch` / `POST preview`: check en el **servicio** (`TechnicalSheetsService.generate`), porque depende del body:
  ```ts
  const canCost = await this.roleAccess.isSectionAllowed(tenantId, role, "recipes.cost");
  const canFicha = await this.roleAccess.isSectionAllowed(tenantId, role, "recipes.ficha");
  if (dto.recipeCardOnly) { /* siempre permitido si llegó hasta aquí */ }
  else {
    if (!canFicha) throw new ForbiddenException({ error: "SECTION_HIDDEN", section: "recipes.ficha" });
    if (dto.includeCosts && !canCost) throw new ForbiddenException({ error: "SECTION_HIDDEN", section: "recipes.cost" });
  }
  ```
- `TechnicalSheetsModule` importa `RoleAccessModule`. El servicio recibe `role` + `tenantId` desde el controller (`req.user.role`, `req.tenantId`).

### Producción (`production.controller.ts`)

- Clase: `@RequireSection("production")` (Phase 1).
- **Verificado**: el board del dashboard lee `upcomingProductionTasks` de `GET /v1/dashboard/kpis` (`frontend/src/hooks/use-dashboard-kpis.ts:43`), NO de `GET /production/batches`. La lectura se resuelve en Dashboard (abajo), sin bloquear. Solo la **acción** pasa por el controller de producción.
  - `PUT orders/:orderId/complete` (`use-dashboard-kpis.ts:56`) → override a `@RequireSection("production","production.tasks")`.
  - `PATCH orders/:orderId/postpone` (`:78`), `PATCH orders/reorder` (`:99`) → **mantener** solo `@RequireSection("production")` de clase (asunción: el rol restringido no pospone/reordena; ver Open Question del plan).
  - `GET orders/:batchId/tasks`, `GET progress/:orderId`, `GET orders/:orderId/mise-en-place-sheet` → override `@RequireSection("production","production.tasks")` por si alguna vista de solo-lectura los usa; si no se usan desde el rol restringido, dejar como clase.
- Todo lo demás (batches POST, mise-en-place writes, staff, assignments, reports) hereda `@RequireSection("production")` de clase ⇒ 403 para el rol restringido. ✔️

### Dashboard KPIs (`dashboard.controller.ts` / `dashboard.service.ts`)

- `dashboard.controller.ts` hoy: `@UseGuards(AuthGuard, TenantGuard, RolesGuard)`, sin `@Roles` en `kpis`. **No** añadir `@RequireSection` que bloquee (el rol necesita el dashboard).
- En `DashboardService.getKpis(tenantId, role)`: si `!isSectionAllowed(tenantId, role, "recipes.cost")` ⇒ omitir/`null` los campos monetarios (`costTrend`, `menuMargin`, valores € de alertas, spend). Mantener `upcomingProductionTasks`, contadores no monetarios.
- `GET metrics/cost-trend`, `metrics/menu-margin` → `@RequireSection("recipes.cost")` (o `"escandallos"`; usar `recipes.cost`).
- `GET alerts` / `alerts/stats` → filtrar alertas de tipo precio/coste cuando `!recipes.cost`.
- `DashboardModule` importa `RoleAccessModule`.

### Asistente IA (`ai-assistant/`)

- `ai-assistant.service.ts` `ask(tenantId, userId, ...)` → añadir `role` (desde el controller: `req.user.role`).
- `tool-registry.service.ts` `getTools(ctx)` recibe `{ tenantId, role }`. Nuevo (nombres de tool **verificados** en `tools/*.tool.ts` — son `get_*`, no kebab):
  ```ts
  const canCost = await this.roleAccess.isSectionAllowed(tenantId, role, "recipes.cost");
  const COST_TOOLS = new Set([
    "get_recipe_cost",            // recipe-cost.tool.ts
    "get_price_history",          // price-history.tool.ts
    "get_price_increases",        // price-increases.tool.ts
    "get_top_spend_products",     // purchase-spend.tool.ts
    "get_supplier_spend",         // purchase-spend.tool.ts
    "get_pending_price_deviations", // pending-price-deviations.tool.ts
  ]);
  let tools = ALL_TOOLS;
  if (!canCost) tools = tools.filter((t) => !COST_TOOLS.has(t.name));
  ```
- Tools permitidas con saneo cuando `!canCost`:
  - `top-purchased-products.tool.ts` (`get_top_purchased_products`): quitar `totalSpend`/`avgPrice`/campos €; dejar `productName`, `totalQuantity`, `unit`, `timesPurchased`.
  - `stock.tool.ts` (`get_low_stock_products`, `get_product_stock`): quitar valoración € si la devuelve; dejar cantidades.
  - Implementar vía flag `sanitizeMoney` pasado al `execute` de la tool, o un post-procesado en el registry sobre keys conocidas.
- `SYSTEM_PROMPT` (`ai-assistant.service.ts:81`): si `!canCost`, prepend/append: "Este usuario no tiene permiso para ver costes ni precios de compra. Si preguntan por importes, coste de recetas, gasto o variaciones de precio, responde que no tienes acceso a esa información para su rol. Sí puedes informar de qué se ha comprado y en qué cantidades."
- `AiAssistantModule` importa `RoleAccessModule`.
- Specs: `tool-registry.service.spec.ts` — caso `role=USER` con `recipes.cost=false` ⇒ catálogo sin COST_TOOLS; `top-purchased-products` sin campos €.

## Related Code Files

- Modify: `backend/src/modules/recipes/recipes.controller.ts`
- Modify: `backend/src/modules/technical-sheets/technical-sheets.controller.ts` + `technical-sheets.service.ts` + `.module.ts`
- Modify: `backend/src/modules/production/production.controller.ts`
- Modify: `backend/src/modules/dashboard/dashboard.controller.ts` + `dashboard.service.ts` + `.module.ts`
- Modify: `backend/src/modules/ai-assistant/ai-assistant.service.ts`, `ai-assistant.controller.ts`, `tools/tool-registry.service.ts`, `tools/top-purchased-products.tool.ts`, `tools/stock.tool.ts`, `ai-assistant.module.ts`
- Modify: `backend/src/guards/section-access.guard.ts` (regla clase-AND-método) + `.spec.ts`
- Modify: specs afectados

## Implementation Steps

1. Ajustar `SectionAccessGuard` a la regla (classKeys AND methodKeys-OR) + actualizar spec.
2. Recetas: `@RequireSection` de método en `calculate` y writes. Spec.
3. Technical-sheets: `@RequireSection` de clase + checks de servicio por body. Pasar `role`/`tenantId` al servicio. Spec del carve-out `recipeCardOnly`.
4. Producción: overrides `@RequireSection("production","production.tasks")` en lectura de tareas + `complete`. Verificar de dónde sale `upcomingProductionTasks` y gatear ahí. Spec.
5. Dashboard: `getKpis(role)` saneado; `@RequireSection("recipes.cost")` en metrics de coste; filtrado de alertas. Spec.
6. Asistente IA: `role` end-to-end; filtrado de tools + saneo € + system prompt. Specs de `tool-registry`.
7. `bun test` backend completo; `bunx tsc --noEmit`.

## Success Criteria

- [ ] USER `recipes.cost=false`: `GET /recipes/:id/calculate` ⇒ 403; `GET /dashboard/kpis` ⇒ 200 sin campos € ; `GET /dashboard/metrics/menu-margin` ⇒ 403.
- [ ] USER `recipes.edit=false`: `PATCH /recipes/:id` ⇒ 403; `GET /recipes` y `GET /recipes/:id` ⇒ 200.
- [ ] USER `recipes.ficha=false` + `recipes=true`: `POST /technical-sheets/generate {recipeCardOnly:true}` ⇒ 200 (PDF); `POST /technical-sheets/generate {includeCosts:true}` ⇒ 403.
- [ ] USER `production=false` + `production.tasks=true`: `PUT /production/orders/:id/complete` ⇒ 200; `POST /production/batches` ⇒ 403; `GET /production/batches` (board) ⇒ 200.
- [ ] Asistente IA (USER, `recipes.cost=false`): "coste de la receta X" ⇒ respuesta de "sin acceso"; "¿compramos tomate en agosto?" ⇒ cantidades sin €. `tool-registry` no expone `recipe_cost`/`purchase_spend`.
- [ ] Sin config: recetas, producción, dashboard, asistente responden exactamente como hoy (specs previos verdes).
- [ ] `bun test` backend verde.

## Risk Assessment

- **Origen de `upcomingProductionTasks`**: si el board del dashboard llama a `production` endpoints directamente (no a `dashboard/kpis`), hay que gatear ambos caminos. Verificar `frontend/src/hooks/use-dashboard-kpis.ts` en Phase 3 y ajustar aquí si hace falta.
- **Saneo € incompleto** en tools/KPIs: enumerar exhaustivamente los campos monetarios; añadir test que haga `JSON.stringify(result)` y falle si contiene `"€"` o keys de la lista negra cuando `!canCost`.
- **`DELETE /recipes` doble gate** (`@Roles("ADMIN")` + `@RequireSection`): no romper el caso ADMIN (bypass en guard ya lo cubre).

<!-- Updated: Validation Session 1 (2026-08-30) — decisiones: Proveedores casilla propia, Escandallos casilla propia, clic tarea no navega, tareas solo ver+completar, VIEWER siempre RO, transversales incluidos, efecto en recarga. Ver plan.md ## Validation Log. -->
