---
phase: 5
title: 'Frontend: adaptación de Recetas + E2E + docs'
status: completed
priority: P2
dependencies:
  - 3
---

# Phase 5: Frontend — adaptación de Recetas + E2E + docs

## Overview

Ajustar `recipes/page.tsx` para honrar `recipes.cost`, `recipes.ficha` y `recipes.edit`; pruebas E2E del rol restringido y del caso "sin config"; actualizar documentación.

## Requirements

- Funcional: USER sin `recipes.edit` en `/dashboard/recipes` — ve el listado, al pulsar una fila abre `RecipeVisualView` (no el modal de edición); sin botón "Nueva receta", sin borrar, sin duplicar, sin editar; puede imprimir.
- Funcional: USER sin `recipes.cost` — sin columna "Costo/Ración", sin badge de desvío de coste, sin `RecipeCostModal`, sin `recipe-pricing-editor`; el orden por "costPerUnit" se oculta o degrada.
- Funcional: USER sin `recipes.ficha` — sin botón "Ficha técnica" (`handleViewSheet`).
- Funcional: ADMIN/OWNER y cualquier rol sin restricción — página idéntica a hoy.
- No-funcional: sin llamadas al endpoint de coste (`/recipes/:id/calculate`) cuando `!canSee('recipes.cost')` (evitar 403 en consola / spinners rotos).

## Architecture

### `frontend/src/app/dashboard/recipes/page.tsx`

- `const { canSee } = useSectionAccess();`
  - `const canCost = canSee('recipes.cost');`
  - `const canFicha = canSee('recipes.ficha');`
  - `const canEdit = canSee('recipes.edit');`
- **Coste (`!canCost`)**:
  - No renderizar la columna "Costo/Ración" (`renderSortableHeader('Costo/Ración','costPerUnit')` ~L720) ni la celda (`formatEuro(costPerPortionOf(recipe))` ~L789).
  - `sortField`: excluir `'costPerUnit'` de las opciones; si estaba seleccionado, fijar `'name'`.
  - No montar `RecipeCostModal` (import L29) ni `recipe-pricing-editor` en el modal.
  - No disparar el hook de coste por receta (`useRecipeCost` / `['recipe-cost', id]`) — condicionar su `enabled`.
  - Badge de desvío (`recipe.pricing.costPercentage > targetCostPercentage`, ~L735) oculto.
  - `costBreakdown` puede venir vacío del backend (Phase 2); la UI ya no lo usa.
- **Ficha (`!canFicha`)**:
  - Ocultar botón "Ficha técnica" (~L830) y `handleViewSheet`.
  - `RecipeVisualView` sigue disponible; su botón imprimir (`handleViewRecipeCard` → `recipeCardOnly`) sigue funcionando.
- **Edición (`!canEdit`)**:
  - Fila de la tabla (desktop) → `onClick` abre `setVisualViewRecipe(recipe)` en vez del modal de edición (igual que ya hace la vista móvil, ~L681).
  - Ocultar: botón "Nueva receta", acción borrar, acción duplicar, botón editar. El modal de creación/edición no se monta.
  - Los combobox de ingredientes / editores quedan fuera (no se renderiza el modal).
- Si `!canCost && !canEdit && !canFicha` el resultado es exactamente el caso "sala": listado + `RecipeVisualView` + imprimir.

### E2E (`frontend` — Playwright; ver `web-testing` / carpeta e2e existente)

- Reusar patrón de tests e2e del repo (buscar `*.spec.ts` de Playwright; `E2E_BASE_URL`, ver memoria `dev-server-3000-runs-from-main-checkout`).
- Caso A — **rol restringido**: seed/among fixtures un USER con config `roleAccess.USER` = {recipes:true, recipes.cost:false, recipes.ficha:false, recipes.edit:false, production:false, production.tasks:true, sala-notificaciones:true, asistente-ia:true, resto:false}. Verificar:
  - nav sin Almacén/Compras/Equipo/etc.; con Recetas, Notif. Sala, Asistente.
  - `/dashboard/articulos` redirige a `/dashboard`.
  - Recetas: sin columna Costo, sin "Nueva receta"; clic abre `RecipeVisualView`; imprimir genera PDF.
  - Dashboard: card "Tareas de Prep." presente, botón completar funciona; sin cards de coste.
  - Asistente: pregunta de coste ⇒ "sin acceso"; pregunta de compras ⇒ responde.
- Caso B — **sin config**: USER estándar, sin filas `roleAccess.*` ⇒ ve todo como antes (regresión).
- Caso C — **ADMIN**: config de USER no le afecta.

### Docs

- `docs/system-architecture.md` — nueva subsección "Acceso por rol (SectionAccessGuard)": relación con el sistema de módulos, tabla `Configuration` keys `roleAccess.*`, orden de guards.
- `docs/codebase-summary.md` — mencionar módulo `role-access` y hook `useSectionAccess`.
- `docs/code-standards.md` — si documenta guards/decoradores, añadir `@RequireSection`.
- No tocar otros docs.

## Related Code Files

- Modify: `frontend/src/app/dashboard/recipes/page.tsx`
- Possibly modify: `frontend/src/app/dashboard/recipes/components/recipe-cost-modal.tsx` import boundary (lazy)
- Create: `frontend/e2e/role-access.spec.ts` (o donde vivan los e2e)
- Modify: `docs/system-architecture.md`, `docs/codebase-summary.md`, `docs/code-standards.md`

## Implementation Steps

1. `recipes/page.tsx`: introducir `canCost/canFicha/canEdit`, aplicar los tres bloques de ocultación.
2. Condicionar hooks de coste (`enabled: canCost`).
3. Verificar en navegador los 3 sub-casos (cost off / ficha off / edit off) por separado y combinados.
4. Escribir E2E casos A/B/C; ejecutar contra un backend local con puerto propio (`E2E_BASE_URL`).
5. Actualizar los 3 docs; verificar fechas/enlaces.
6. `bun run build` frontend; `bun test` backend; typecheck ambos.
7. Consistencia whole-plan: releer plan.md + fases, reconciliar (p. ej. la regla clase-AND-método del guard quedó definida en Phase 2 → reflejar en Phase 1 success criteria).

## Nota de implementación (2026-08-30)

- **E2E**: el repo solo tiene Playwright *smoke sin backend* (`frontend/e2e/*.spec.ts`) y no hay runner de unit-test de frontend. Construir un E2E con backend + BD + seed de config queda fuera del alcance realista de esta fase (ver Risk Assessment). Sustituido por: cobertura unit backend exhaustiva (guard, servicio, tools, KPI strip, carve-out ficha — +20 tests, suite 1748 verde) + checklist de QA manual documentado abajo + revisión `code-reviewer`.
- **Docs**: se actualizó `docs/authorization-model.md` (nueva sección "Acceso por Sección (SectionAccessGuard)" + cadena de guards) y `docs/codebase-summary.md`. `docs/code-standards.md` no documenta guards → sin cambios.

### Checklist QA manual (backend + frontend levantados)

1. ADMIN → Configuración → "Permisos por rol": aparece la matriz USER/VIEWER con los apartados activos del tenant.
2. Configurar USER: Recetas ON, `ver coste` OFF, `ver ficha` OFF, `editar` OFF; Producción OFF + `ver tareas` ON; Notif. Sala ON; Asistente ON; resto OFF. Guardar.
3. Login como ese USER:
   - Nav: solo Recetas, Notif. Sala, Asistente. Sin Almacén/Compras/Equipo/APPCC/Menús.
   - `/dashboard/articulos` por URL → redirige a `/dashboard`.
   - Recetas: sin columna Costo, sin botón Ficha, sin "Crear Receta", sin editar/borrar; "Vista visual" + "Imprimir" funcionan; imprimir genera PDF.
   - Dashboard: card "Tareas de Prep." visible, botón completar funciona, fila NO navega; sin card de compras/alertas.
   - Asistente: "¿cuánto cuesta la receta X?" → "no tengo acceso a costes"; "¿compramos tomate?" → responde con cantidades.
4. Sin config (otro tenant / borrar filas): USER y VIEWER ven todo como antes.
5. ADMIN del mismo tenant: nada cambia.

## Success Criteria

- [ ] Los 3 sub-flags de Recetas producen exactamente la UI descrita, por separado y combinados.
- [ ] Con `recipes.cost=false` no hay ninguna request a `/recipes/:id/calculate` desde la página (verificar en Network).
- [ ] E2E caso A (rol restringido) verde; caso B (sin config, sin regresión) verde; caso C (ADMIN intacto) verde.
- [ ] Docs actualizados y coherentes con la implementación.
- [ ] `bun run build` frontend + `bun test` backend + typecheck verdes.

## Risk Assessment

- **`recipes/page.tsx` es grande y muy usado**: cambios de ocultación deben ser aditivos y guardados tras cada bloque; alto riesgo de regresión para ADMIN si un condicional queda invertido → E2E caso C es la red de seguridad.
- **E2E frágiles**: seguir exactamente el patrón/fixtures existentes; si el repo no tiene infra de e2e con seed de config, reducir a un test de integración frontend + verificación manual documentada.
- **Lazy import de `RecipeCostModal`**: si no se importa condicionalmente, el bundle no cambia pero tampoco se rompe; prioridad baja.
