---
phase: 3
title: 'Frontend: entrega de config, nav y dashboard'
status: completed
priority: P1
dependencies:
  - 2
---

# Phase 3: Frontend — entrega de config, nav y dashboard

## Overview

Consumir `GET /role-access/me`, exponer `useSectionAccess()`, filtrar la navegación y las redirecciones por URL, y ocultar las cards del dashboard según secciones. No incluye la pantalla de configuración (Phase 4) ni la página de Recetas (Phase 5).

## Requirements

- Funcional: la nav (desktop dropdowns, mobile "Más", bottom nav) oculta los apartados no permitidos para el rol del usuario.
- Funcional: navegar por URL a un apartado no permitido redirige a `/dashboard` (igual que hoy con módulos).
- Funcional: el dashboard home oculta las cards ligadas a secciones no permitidas (Tareas de Prep ↔ `production.tasks`, card Notif. Sala ↔ `sala-notificaciones`, cards/alertas de coste ↔ `recipes.cost`, KPIs de compras ↔ `compras`).
- No-funcional: mientras carga el acceso, no parpadear nav oculta (mismo patrón que `useModules`: durante carga, mostrar todo).
- No-funcional: ADMIN/OWNER/SUPERADMIN ven todo (el endpoint ya devuelve todo `true`).

## Architecture

### API + hook

- `frontend/src/features/modules/api/` → nuevo `role-access-api.ts`: `fetchMySectionAccess(): Promise<Record<string,boolean>>` → `GET /api/v1/role-access/me` (interceptor desenvuelve `{success,data}` — devolver el mapa).
- `frontend/src/features/modules/hooks/use-section-access.ts` (nuevo), espejo de `use-modules.ts`:
  ```ts
  export function useSectionAccess() {
    const { user } = useAuth();
    const [map, setMap] = useState<Record<string, boolean> | null>(null);
    const refetch = useCallback(async () => { setMap(await fetchMySectionAccess()); }, []);
    const canSee = useCallback((key?: string) => {
      if (!key) return true;
      if (!map) return true;                 // durante carga: no ocultar
      return map[key] ?? true;               // ausente ⇒ permitido
    }, [map]);
    return { map, refetch, canSee };
  }
  ```
- Alternativa DRY: fusionar en `useModules` un único fetch que traiga módulos + acceso de sección. Decisión: hook separado, misma vida (`layout.tsx` hace `refetch()` al autenticar, igual que módulos).

> **Implementado con mejora**: `use-section-access.ts` usa un store a nivel de módulo + `useSyncExternalStore` (no `useState` local). Motivo: `dashboard/page.tsx` y `layout.tsx` son instancias separadas del hook; con `useState` local el `map` de la página nunca cargaría (mismo bug latente que `useModules` hoy). El store compartido dispara UN fetch mientras haya algún consumidor montado; `refetchSectionAccess()` (exportado) fuerza recarga tras guardar config o un 403 `Section '...'`. Sin `useEffect`.

### nav-config.ts

- `NavItem` → añadir `sectionKey?: string`. Rellenar en `NAV_GROUPS` y `MOBILE_NAV`:
  - Ítems con `moduleId` → `sectionKey` = mismo id (`recipes`, `production`, `compras`, …). Para "Equipo" (`moduleId:'sala'`) → `sectionKey:'sala'`.
  - Ítems transversales sin `moduleId` → añadir `sectionKey`: Histórico de precios → `historico-precios`, Papelera → `papelera`, Copias de Seguridad → `backups`, Sprint → `sprint`.
  - "Asistente IA" → `sectionKey:'asistente-ia'`.
- Nuevo helper `sectionForPath(pathname)` (paralelo a `moduleForPath`) usando un `ROUTE_SECTION_MAP` (o extender `ROUTE_MODULE_MAP` con `sectionKey`). Cubrir también `/dashboard/historico-precios`, `/dashboard/papelera`, `/dashboard/backups`, `/dashboard/sprint-tracker`, `/dashboard/production` (sección `production`; el board del dashboard NO es esta ruta).

### layout.tsx

- Consumir `useSectionAccess()`; `refetch()` en el mismo `useEffect` que módulos (`isAuthenticated`).
- `visibleGroups`: filtrar cada item por `isEnabled(item.moduleId) && canSee(item.sectionKey)`.
- `MOBILE_NAV` filter: `isEnabled(item.moduleId) && canSee(item.sectionKey)`.
- Redirección por URL: extender el `useEffect` de `moduleForPath` para también comprobar `sectionForPath(pathname)` con `canSee`; si oculto ⇒ `router.replace('/dashboard')`.
- Escuchar un evento `chefchek:section-hidden` (dispatch desde `api-client` al recibir 403 `SECTION_HIDDEN`, análogo al `chefchek:module-disabled` existente) → `refetch()` + salir de la ruta.
- `AssistantFloatingWidget`: render sólo si `isEnabled('asistente-ia') && canSee('asistente-ia')`.

### api-client (`frontend/src/lib/` o `services/`)

- Donde hoy detecta 403 de módulo deshabilitado y hace `window.dispatchEvent(new Event('chefchek:module-disabled'))`, añadir rama: si `error.error === 'SECTION_HIDDEN'` ⇒ `dispatchEvent('chefchek:section-hidden')`.

### Dashboard home (`frontend/src/app/dashboard/page.tsx`)

- `useSectionAccess()`; derivar flags: `showPrepTasks = canSee('production') || canSee('production.tasks')`, `showSalaCard = isEnabled('sala-notificaciones') && canSee('sala-notificaciones')` (ya existe `salaNotificacionesEnabled`; añadir `&& canSee`), `showCostCards = canSee('recipes.cost')`, `showComprasKpis = canSee('compras') || canSee('albaranes')`.
- `tareasPendientesBoard`:
  - Render si `showPrepTasks`.
  - Si `!canSee('production')` (solo `production.tasks`): fila NO navega (`onNavigate` = no-op o quitar `cursor-pointer` y el `router.push`); mantener botón "Completar". Ocultar botón "VER LISTA DE PREPARACIÓN COMPLETA" (lleva a `/dashboard/production/tasks`, bloqueado) o que apunte a un modal de solo lectura (fuera de scope → ocultar).
  - Drag reorder (`handleTaskDragEnd` / `useReorderProductionTasks`): deshabilitar `DndContext` si `!canSee('production')`.
  - Postpone: ocultar acción si `!canSee('production')`.
- Cards de coste/alertas de precio: envolver en `showCostCards`.

## Related Code Files

- Create: `frontend/src/features/modules/api/role-access-api.ts`
- Create: `frontend/src/features/modules/hooks/use-section-access.ts`
- Modify: `frontend/src/features/modules/lib/nav-config.ts` (campo `sectionKey`, `ROUTE_SECTION_MAP`, `sectionForPath`)
- Modify: `frontend/src/app/dashboard/layout.tsx`
- Modify: `frontend/src/app/dashboard/page.tsx`
- Modify: `frontend/src/app/dashboard/upcoming-task-row.tsx` (prop `navigable`/`readOnly`)
- Modify: api-client 403 handler (localizar el que emite `chefchek:module-disabled`)
- Reference: `frontend/src/features/modules/hooks/use-modules.ts`, `frontend/src/hooks/use-dashboard-kpis.ts`

## Implementation Steps

1. `role-access-api.ts` + `use-section-access.ts`.
2. `nav-config.ts`: añadir `sectionKey` a todos los items (module-backed + transversales), `ROUTE_SECTION_MAP` + `sectionForPath`.
3. `layout.tsx`: hook, filtrado de `visibleGroups`/`MOBILE_NAV`, redirección por sección, listener `chefchek:section-hidden`, gate del widget del asistente.
4. api-client: rama `SECTION_HIDDEN`.
5. `page.tsx` + `upcoming-task-row.tsx`: flags de cards, board de tareas en modo lectura, cards de coste.
6. Verificar en el navegador con un USER de prueba configurado (ver `api-testing-auth-session-tenant` en memoria; tenant demo). `bun run build` frontend.

## Success Criteria

- [ ] USER con `almacenes/compras/albaranes/articulos/proveedores/menus/appcc/sala=false`: esos apartados no aparecen en ningún menú; ir a su URL redirige a `/dashboard`.
- [ ] USER con `sala-notificaciones=true`: "Notificaciones de Sala" visible y usable.
- [ ] USER con `production=false, production.tasks=true`: dashboard muestra "Tareas de Prep. Próximas", puede completar, la fila no navega, no hay reordenar/postponer, no hay botón "ver lista completa".
- [ ] USER con `recipes.cost=false`: dashboard sin cards de coste/margen ni alertas de precio.
- [ ] ADMIN: nav y dashboard sin cambios.
- [ ] `bun run build` frontend verde; sin `useEffect` nuevo que viole `no-use-effect` (seguir patrón de `useModules`, que ya usa `useState`+`useCallback`; el `refetch` se dispara desde el `useEffect` existente de `layout.tsx`).

## Risk Assessment

- **Regla `no-use-effect`**: `use-section-access` debe replicar el patrón de `use-modules` (sin `useEffect` propio; `refetch` imperativo llamado desde `layout.tsx`).
- **Flash de nav**: `canSee` devuelve `true` mientras `map===null`; aceptar el mismo trade-off que `useModules`.
- **`use-dashboard-kpis`**: si llama endpoints de producción directamente, confirmar que Phase 2 los gateó con `production.tasks`.

<!-- Updated: Validation Session 1 (2026-08-30) — decisiones: Proveedores casilla propia, Escandallos casilla propia, clic tarea no navega, tareas solo ver+completar, VIEWER siempre RO, transversales incluidos, efecto en recarga. Ver plan.md ## Validation Log. -->
