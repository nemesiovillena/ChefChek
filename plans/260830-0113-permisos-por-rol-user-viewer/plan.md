---
title: Permisos por rol (USER/VIEWER) configurables por tenant
description: >-
  Pantalla en Configuración donde OWNER/ADMIN elige qué apartados ven los roles
  USER y VIEWER de su cliente, con sub-opciones en Recetas y Producción y
  filtrado de costes en el Asistente IA.
status: pending
priority: P2
branch: feat/sala-notificaciones-kanban
tags:
  - authz
  - rbac
  - permissions
  - settings
  - ai-assistant
blockedBy: []
blocks: []
created: '2026-08-29T23:19:35.006Z'
createdBy: 'ck:plan'
source: skill
---

# Permisos por rol (USER/VIEWER) configurables por tenant

## Overview

Hoy la navegación de ChefChek se filtra **solo** por módulos activos del tenant (`ModuleGuard` + `nav-config.ts`), nunca por rol. El `RolesGuard` es estrictamente jerárquico (`SUPERADMIN>OWNER>ADMIN>USER>VIEWER`), así que no puede expresar "este USER ve Recetas en solo-lectura pero completa tareas de producción".

Este plan añade una **capa de visibilidad por rol, por tenant**, encima del sistema de módulos:

- Nueva pantalla en **Configuración** (solo OWNER/ADMIN): dos columnas (USER / VIEWER), un check por apartado activo del tenant + sub-checks dentro de Recetas (`ver coste`, `ver ficha técnica`, `editar`) y Producción (`ver tareas de preparación`).
- Solo afecta a **USER y VIEWER**. ADMIN/OWNER/SUPERADMIN siguen viéndolo todo.
- **Compatibilidad total**: sin configuración guardada, USER y VIEWER ven exactamente lo de hoy. La feature solo **quita** acceso (valor explícito `"false"`).
- El **Asistente IA** deja de exponer importes € cuando el rol no puede ver costes; sigue respondiendo "¿hemos comprado X?" y cantidades/stock.
- Apartados transversales (Histórico de precios, Papelera, Copias de seguridad, Sprint) también son ocultables.

Precedentes en el repo: `plans/260623-1648-module-activation` (patrón `Configuration` key/value + guard), `plans/260701-1659-superadmin-role-refactor`, `plans/260827-1822-recipe-visual-view` (vista solo-lectura de receta, ya en prod).

## Decisiones cerradas (con el usuario)

| Tema | Decisión |
|---|---|
| Rol nuevo | **No.** Se configura USER y VIEWER directamente. |
| Dónde se configura | Pantalla en Configuración, **OWNER/ADMIN**, por tenant. |
| Granularidad | On/off por apartado + subs de Recetas (`coste`, `ficha`, `editar`) y Producción (`tareas`). |
| Producción para el rol "sala" objetivo | Sección Producción **OFF**; sub `production.tasks` **ON** → ve y **completa** las "Tareas de Prep. Próximas" del dashboard. No crea lotes. |
| Asistente IA sin costes | Bloquea tools con € (`recipe-cost`, `price-history`, `price-increases`, `purchase-spend`, `pending-price-deviations`); permite `top-purchased-products` y `stock` **sin campos de precio**. |
| Transversales | Ocultables (`historico-precios`, `papelera`, `backups`, `sprint`). |
| Escritura VIEWER | La config controla **visibilidad**; el rol sigue controlando escritura. VIEWER permanece solo-lectura aunque se le muestre un apartado. El sub-check `recipes.edit` degrada a un USER a solo-lectura en Recetas. |
| Almacenamiento | Reusar tabla `Configuration` (`@@unique([tenantId, key])`), claves `roleAccess.{USER\|VIEWER}.{sectionKey}`, `category: "ROLE_ACCESS"`. Ausencia ⇒ permitido. |
| Efecto al guardar | Aplica en el próximo `refetch` de estados (mismo mecanismo que módulos: `layout.tsx` refetch al navegar / re-login). Sin WebSocket. |
| Impresión de receta | La actual (`RecipeVisualView` → `POST /technical-sheets/generate {recipeCardOnly:true}`). Alérgenos **sí** se ven. |

## Modelo de secciones

`backend/src/modules/role-access/constants/section-registry.ts` (nuevo), espejo de `MODULE_REGISTRY` + transversales + subs:

```
Ligadas a módulo:  articulos, categories, recipes, menus, escandallos, almacenes,
                   production, sala, sala-notificaciones, appcc, allergens,
                   digital-menu, albaranes, compras, proveedores, conocimiento,
                   technical-sheets, asistente-ia
Transversales:     historico-precios, papelera, backups, sprint
Sub-capacidades:   recipes.cost, recipes.ficha, recipes.edit, production.tasks
```

Regla de resolución (`RoleAccessService.isSectionAllowed(tenantId, role, key)`):
1. `role` ∈ {SUPERADMIN, OWNER, ADMIN} ⇒ `true` siempre.
2. USER/VIEWER ⇒ `Configuration` key `roleAccess.${role}.${key}`; ausente ⇒ `true`.
3. Una sección ligada a módulo cuyo módulo está **desactivado en el tenant** ⇒ `false` (no se muestra a nadie; la pantalla de config no la lista).

`@RequireSection(...keys)` pasa si **alguna** key está permitida (permite `@RequireSection("production","production.tasks")`).

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Backend: núcleo de acceso por sección](./phase-01-backend-nucleo-de-acceso-por-seccion.md) | Completed |
| 2 | [Backend: gating fino (coste recetas, tareas producción, asistente IA)](./phase-02-backend-gating-fino-recetas-produccion-asistente.md) | Completed |
| 3 | [Frontend: entrega de config, nav y dashboard](./phase-03-frontend-entrega-config-nav-y-dashboard.md) | Completed |
| 4 | [Frontend: pantalla "Permisos por rol"](./phase-04-frontend-pantalla-permisos-por-rol.md) | Completed |
| 5 | [Frontend: adaptación de Recetas + E2E + docs](./phase-05-frontend-adaptacion-recetas-e2e-y-docs.md) | Completed |

Dependencias: 1 → 2 → 3 → 4 → 5 (secuencial; 4 y 5 pueden solaparse tras 3).

## Acceptance Criteria

- [ ] OWNER/ADMIN puede abrir Configuración → "Permisos por rol", ver 2 columnas (USER/VIEWER) con los apartados activos del tenant y guardar cambios.
- [ ] Un USER con Recetas restringida a "solo ver + imprimir": ve el listado de recetas, abre `RecipeVisualView`, imprime; NO ve columna Costo, botón Ficha, botón Nueva receta, ni el modal de edición; `GET /recipes/:id/calculate` responde 403; `POST/PATCH/DELETE /recipes` responde 403.
- [ ] Ese USER: no ve en la nav Almacén, Compras, Albaranes, Artículos, Proveedores, Equipo, Menús, APPCC (según config); el acceso directo por URL redirige a `/dashboard`; los endpoints correspondientes responden 403.
- [ ] Ese USER: ve "Notificaciones de Sala" y puede crear; ve el dashboard con la card "Tareas de Prep. Próximas" y puede **completar** tareas; NO ve `/dashboard/production` ni puede crear lotes (403).
- [ ] Asistente IA con ese USER: preguntar "¿cuánto cuesta la receta X?" o "¿cuánto gastamos en compras?" → responde que no tiene acceso a costes; "¿hemos comprado tomate este mes?" → responde con cantidades, sin importes.
- [ ] Sin ninguna configuración guardada: USER y VIEWER se comportan igual que antes de este plan (no hay regresión).
- [ ] ADMIN/OWNER/SUPERADMIN no se ven afectados por ninguna configuración.
- [ ] `bun test` backend verde (nuevos specs de `RoleAccessService`, `SectionAccessGuard`, filtrado de tools); typecheck/lint verde en front y back.

## Riesgos

- **Regresión de acceso** para tenants que ya usan USER/VIEWER esperando "lo ven todo". Mitigación: default = permitido; sin escritura de config no cambia nada; E2E de "sin config".
- **Fugas de coste** por rutas no gateadas (KPIs dashboard, PDF ficha, tools IA). Mitigación: Phase 2 enumera cada superficie de € y la corta en backend, no solo en UI.
- **Doble fuente de verdad** módulos vs secciones. Mitigación: `section-registry` importa `MODULE_REGISTRY`; las secciones ligadas a módulo heredan su id.
- **Complejidad de la pantalla** si crece a matriz enorme. Mitigación: YAGNI — solo USER/VIEWER, solo apartados activos, subs solo en Recetas y Producción.

## Open Questions

Ninguna. Todas resueltas en la entrevista de validación (2026-08-30):

- **Proveedores**: casilla propia, independiente de Artículos.
- **Escandallos**: casilla de apartado propia; `recipes.cost` solo afecta a la página Recetas + Asistente IA + KPIs.
- **Clic en fila de "Tareas de Prep."** con Producción oculta: la fila **no navega**; solo queda el botón "Completar".
- **`production.tasks`**: solo ver + **completar** (posponer y reordenar siguen requiriendo el apartado `production`).
- **VIEWER**: la config controla solo **visibilidad**. VIEWER sigue siendo solo-lectura siempre; el sub-check `recipes.edit` solo tiene efecto para USER.
- **Transversales** (Histórico de precios, Papelera, Copias de seguridad, Sprint): **incluidos** en este plan como casillas ocultables.
- **Efecto al guardar**: se aplica en la próxima navegación/recarga del usuario afectado (refetch, sin WebSocket).
- Nombre de la pantalla: "Permisos por rol".

## Validation Log

### Verification Results (2026-08-30)
- Tier: Full (5 fases). Claims comprobados: 12. Verified: 9 | Corrected in-place: 5 | Pending user decision: 4.
- ✅ `api-client.ts:174` emite `chefchek:module-disabled` (patrón a replicar para `SECTION_HIDDEN`).
- ✅ Board de tareas del dashboard lee `GET /v1/dashboard/kpis` (`use-dashboard-kpis.ts:43`), no `/production/batches`. Acciones (`complete/postpone/reorder`) sí van a `/v1/production/orders/*`. → Phase 2 corregida.
- ✅ Nombres de tools IA son `get_*` (no kebab): `get_recipe_cost`, `get_price_history`, `get_price_increases`, `get_top_spend_products`, `get_supplier_spend`, `get_pending_price_deviations` (bloquear); `get_top_purchased_products`, `get_low_stock_products`, `get_product_stock` (sanear €). → Phase 2 corregida.
- ✅ No existe controller de Proveedores; vive en `products.controller.ts` rutas `suppliers*` (~L155-565). → Phase 1 corregida (gate a nivel método).
- ✅ `trash.controller.ts`, `sprint/sprint.controller.ts`, `backup/backup.controller.ts` existen → gates `papelera`/`sprint`/`backups`.
- ✅ `users.controller.ts` seguro de gatear (solo lista + mutaciones ADMIN; sin `/me`; settings no lo llama).
- ✅ `historico-precios` no tiene controller propio (data de `products`/offers). Gating solo nav+ruta.
- ✅ `settings/page.tsx` = secciones planas con `<h2>` + componentes en `./components/`. Panel nuevo encaja como sección más.
- ✅ `Configuration` tiene `@@unique([tenantId, key])`, campo `category`, `updatedBy` requerido.
- ⚠️ Ajuste de diseño incorporado: `SectionAccessGuard` evalúa metadata de **clase Y método** por separado (regla en Phase 1).

### Interview (2026-08-30) — 7 preguntas

| # | Decisión | Impacto |
|---|---|---|
| 1 | Proveedores = casilla propia independiente | Completed |
| 2 | Escandallos = casilla propia | Completed |
| 3 | Clic en fila de tarea = no navega | Completed |
| 4 | Tareas = solo ver + completar | Completed |
| 5 | VIEWER siempre solo-lectura | Completed |
| 6 | Transversales incluidos | Phases 1/3 ya los cubren (`papelera`, `backups`, `sprint`, `historico-precios`). Sin recorte de scope. |
| 7 | Efecto = próxima navegación/recarga | Sin WebSocket. Phase 3: `useSectionAccess.refetch()` desde el `useEffect` de `layout.tsx` (igual que módulos). |

### Code Review + Fixes (2026-08-30)

`code-reviewer` sobre el diff completo → `DONE_WITH_CONCERNS`. Arreglado:

| # | Hallazgo | Fix |
|---|---|---|
| C1 | `PUT /production/orders/:id/complete` daba 403 al rol sala (clase-AND-método) — **caso principal roto** | Nuevo decorador `@RequireSectionAny(...)` (handler reemplaza la clase, OR). `complete` lo usa. Guard + spec actualizados. |
| H1 | `GET /recipes`, `/recipes/:id` devolvían coste/PVP/márgenes en el payload aunque `recipes.cost=false` | `formatRecipeResponse(recipe, includeCost)` strip total; `findAll`/`findOne` reciben el flag; `RecipesController` inyecta `RoleAccessService` y resuelve `canViewCost`. +2 specs. |
| H2 | `/v1/alerts` + WS exponían "Precio subió X% de 1€ a 1.5€" a cualquier rol | `notifyPriceChange` → `type:"PRICE_CHANGE"`; `getUserNotifications(excludeCostAlerts)` filtra `PRICE_CHANGE`/`PRICE_AGREEMENT_DEVIATION` + prefijos de título; `AlertsController` pasa el flag por rol; `use-websocket.ts` filtra los eventos en vivo por título. +2 specs. |
| H3 | El panel deshabilitaba `production.tasks` cuando `production` estaba OFF → escenario sala inconfigurable | `PARENT_INDEPENDENT_SUBS` en `role-access-panel.tsx`: `production.tasks` no se atenúa con el padre off. |
| M1 | Caché de sección no se reseteaba en logout/login SPA | `layout.tsx`: `refetchSections()` en el efecto `isAuthenticated`. `resetSectionAccess()` exportado. |
| M2 | `refetchSectionAccess()` ponía caché a null → flash de nav completa | Mantiene el mapa stale hasta que resuelve el nuevo fetch. |
| M3 | Detección de `SECTION_HIDDEN` por prefijo de mensaje (frágil ante i18n) | `GlobalExceptionFilter.getErrorCode` preserva el campo `error` string como `code`; `api-client.ts` matchea `code === 'SECTION_HIDDEN'` (fallback al prefijo). +1 spec. |
| L2 | `updateRoleAccess` escribía las ~50 keys siempre; edición concurrente se pisa | El panel envía solo el diff por rol. |

**Diferido (documentado, no bloqueante):**
- **M4** — queries extra por request para USER/VIEWER (guard memoiza; servicios re-consultan). Pequeñas, indexadas, solo roles no-ADMIN. Follow-up: caché request-scoped del mapa.
- **L1** — sub-keys (`recipes.cost`, `production.tasks`) no heredan módulo padre desactivado (siguen `true`). Sin impacto real (sin módulo no hay datos). 
- **L3** — `categories` fuera de `SECTION_REGISTRY` a propósito (se usa embebido en formularios; gatearlo rompería pickers).
- **L4** — `/dashboard/dashboard-interactivo` llama endpoints de coste que no existen (404, ya muerto). Card sin gatear; si se reactiva la página, gatearla.
- **L5** — gate cliente del panel `['OWNER','ADMIN']` vs backend jerárquico (SUPERADMIN). Cosmético (SUPERADMIN sin tenant no usa esta pantalla).

Post-fix: `npx jest` 113 suites / **1754** verde; `bunx tsc` back+front limpio; `bun run build` OK; eslint 0 errores.

### Whole-Plan Consistency Sweep (2026-08-30)
- Términos revisados: `recipes.cost`/`recipes.edit`/`recipes.ficha`/`production.tasks` consistentes en las 5 fases.
- Regla clase-AND-método del guard: definida en Phase 1, usada en Phase 2 — coherente.
- Nombres de tools IA `get_*`: corregidos en Phase 2, no aparecen nombres kebab en otras fases.
- Proveedores/Escandallos: Phase 1 tabla de controllers actualizada acorde a decisiones 1 y 2.
- `dashboard/kpis` como origen del board de tareas: Phase 2 y Phase 3 coinciden.
- Sin contradicciones sin resolver.

### Hotfix post-release (2026-08-31) — PR #75

**Bug en producción**: un USER con Albaranes/Compras visibles pero Artículos/Proveedores ocultos era **expulsado a /dashboard** al abrir Albaranes o Compras. Causa: el handler de `chefchek:section-hidden` en `layout.tsx` hacía `router.replace('/dashboard')` ante *cualquier* 403 `SECTION_HIDDEN`, y esas páginas embeben llamadas a otras secciones (`useProducts`/`useSuppliers` en el formulario de albarán manual y en todas las pestañas de compras).

**Fix**: el handler solo refresca estado; la redirección de ruta la decide únicamente el efecto proactivo (`sectionForPath(pathname)` + `canSee`), que solo abandona la ruta cuando la sección de la *página actual* es la oculta. Los selectores embebidos ya degradaban a `?? []` sin crash.

Relacionado con el hallazgo H3 de la review (secciones con dependencias cruzadas). Los pickers embebidos siguen 403-eando en silencio — aceptable: un rol sin Artículos no puede casar líneas de albarán con productos, pero sí ver la lista de albaranes.

