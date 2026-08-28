---
phase: 2
title: "Frontend: card dashboard y página Kanban"
status: completed
priority: P2
dependencies: [1]
---

# Phase 2: Frontend: card dashboard y página Kanban

## Overview

Ajustar el límite de la card "Tareas de Prep. Próximas" de 6 a 4, añadir debajo una nueva card resumen "Notificaciones de Sala" con el mismo patrón visual, y crear la página `/dashboard/sala-notificaciones` con el tablero Kanban drag-and-drop (3 columnas) usando `@dnd-kit` (ya es dependencia del proyecto, primer uso de **multi-columna** — el proyecto solo tenía listas simples con `SortableContext`, ver memoria "agent-browser dnd-kit gotcha").

## Requirements

- Funcional: card resumen en dashboard (top 4 por prioridad, **solo `PENDIENTE`/`EN_CURSO`** — excluye `COMPLETADO`, confirmado por el usuario), botón "Mostrar todas" → navega a `/dashboard/sala-notificaciones`; página con 3 columnas (`PENDIENTE`/`EN_CURSO`/`COMPLETADO`), drag-and-drop dentro de columna (reordena prioridad) y entre columnas (cambia estado), botón "Crear" que abre el modal de la fase 3.
- No funcional: mobile-friendly (drag con `TouchSensor`, igual que ya hace `tareasPendientesBoard`); nav-config + gating por módulo coherente con el registro de la fase 1.

## Architecture

- Hook de datos `frontend/src/hooks/use-sala-tasks.ts`: `useSalaTasks()`, `useCreateSalaTask()`, `useUpdateSalaTask()`, `useDeleteSalaTask()`, `useReorderSalaTasks()` — mismo patrón React Query + `apiClient` que `use-dashboard-kpis.ts` (recordar: `apiClient` desenvuelve `{success,data}`, y las respuestas paginadas se desenvuelven solas — ver memorias del proyecto sobre `apiClient`).
- Dashboard (`frontend/src/app/dashboard/page.tsx`):
  - Separar el límite compartido en dos constantes: `PRODUCTION_TASKS_LIMIT = 4` (antes `DASHBOARD_TASKS_LIMIT = 6`) y `SALA_TASKS_LIMIT = 4`.
  - Nuevo bloque `salaTasksBoard` (JSX), estructuralmente igual a `tareasPendientesBoard` (mismo `tonal-layer-2`, header con contador, filas, footer con botón "Mostrar todas" si hay más de `SALA_TASKS_LIMIT` tareas en `PENDIENTE`/`EN_CURSO`), pero sin acciones de completar/posponer — solo click para abrir el modal de detalle (fase 3). El filtro por estado (excluir `COMPLETADO`) se aplica antes de recortar a `SALA_TASKS_LIMIT`, tanto para las filas visibles como para el contador y el cálculo de "hay más".
  - Insertar `salaTasksBoard` justo debajo de `tareasPendientesBoard` dentro de `<div className="md:col-span-8">`.
  - Actualizar el comentario de "Orden móvil" para incluir la nueva card.
- Página nueva `frontend/src/app/dashboard/sala-notificaciones/page.tsx`:
  - Header con título (usar `<div>` para el título de página, **no** `<header>`, ver memoria "globals.css oculta header:not(.fixed) también en headers de página").
  - 3 columnas en grid, cada una un `SortableContext` propio; `DndContext` único envolviendo las 3, `onDragEnd` resuelve tanto reordenar dentro de la misma columna (`arrayMove`) como mover a otra columna (actualiza `status` local + llama `useReorderSalaTasks`).
  - Cards de columna: `sala-task-card.tsx` (título, fecha evento formateada, badge de comensales, nombre cliente si existe) — clic abre el modal de detalle de la fase 3.
  - Botón "Crear" en el header que abre el modal en modo creación.

## Related Code Files

- Create: `frontend/src/hooks/use-sala-tasks.ts`
- Create: `frontend/src/app/dashboard/sala-notificaciones/page.tsx`
- Create: `frontend/src/app/dashboard/sala-notificaciones/sala-task-card.tsx`
- Create: `frontend/src/app/dashboard/sala-notificaciones/sala-task-column.tsx` (si la lógica de columna merece extraerse — evaluar tamaño antes de partir, YAGNI)
- Modify: `frontend/src/app/dashboard/page.tsx` (límites, nuevo bloque `salaTasksBoard`, import del hook)
- Modify: `frontend/src/features/modules/lib/nav-config.ts` (nueva entrada de nav con `moduleId: 'sala-notificaciones'`)

## Implementation Steps

1. Crear `use-sala-tasks.ts` calcando la forma de los hooks de `use-dashboard-kpis.ts` (query keys, invalidation on mutate — no olvidar invalidar tras crear/editar/borrar/reordenar).
2. Refactor mínimo de `page.tsx`: renombrar/duplicar la constante de límite, extraer `salaTasksBoard` siguiendo el mismo esqueleto que `tareasPendientesBoard`.
3. Construir la página Kanban con `@dnd-kit`: un `DndContext` con `collisionDetection={closestCenter}`, un `SortableContext` por columna, `onDragEnd` que detecta columna origen/destino por `over.data.current` o por buscar el contenedor del `over.id`.
4. Cablear `useReorderSalaTasks` para persistir tras cada `onDragEnd` (batch de la columna afectada, o de ambas si cruza columnas).
5. Añadir el link de nav y probar que el gating por módulo oculta la página cuando el módulo está desactivado (redirect a `/dashboard`, patrón ya existente en `dashboard/layout.tsx`).
6. Probar drag-and-drop en escritorio y móvil (usar `agent-browser` si se verifica automatizado — recordar el gotcha de viewport visible para simular drag, ver memoria del proyecto).

## Success Criteria

- [x] Card "Tareas" muestra 4 (no 6) con "ver lista completa" solo si hay más de 4 — confirmado por code-review (rename `DASHBOARD_TASKS_LIMIT`→`PRODUCTION_TASKS_LIMIT` aplicado en los 3 sitios de uso, sin regresión).
- [x] Card "Notificaciones de Sala" aparece debajo, mismo estilo visual, top 4 por prioridad.
- [x] `/dashboard/sala-notificaciones` renderiza 3 columnas — confirmado por build (ruta presente) y code-review de la lógica de columnas/droppable.
- [x] Drag dentro de una columna reordena y persiste (`sortOrder`) — code-review encontró un bug real (el `sortOrder` optimista no se reescribía en las cards cacheadas, causando snap-back visual y riesgo de carrera en drags rápidos consecutivos); **corregido** en este mismo pase.
- [x] Drag entre columnas cambia `status` y persiste — mismo fix que el punto anterior.
- [x] Página respeta el gating de módulo (oculta/redirect si el tenant no lo tiene activo) — confirmado por code-review (`useModules().isEnabled` gatea el fetch, `ROUTE_MODULE_MAP` gatea la URL directa).
- [x] Sin regresión visual/funcional en la card de Tareas existente — confirmado por code-review (diff línea a línea).

**Nota de verificación:** lo anterior se verificó vía `bun run build` (backend+frontend), lint, 10 tests unitarios del backend, y una revisión de código dedicada (code-reviewer, ver reporte en `reports/`). No se hizo una prueba de arrastre real en navegador (sin sesión de browser disponible en este pase) — el fix del bug de `sortOrder` se verificó por lectura de código, no por observación visual del drag. Recomendado un smoke-test manual de drag-and-drop (desktop + móvil) antes de dar por buena la UX en producción.

## Risk Assessment

- **Multi-columna con dnd-kit es nuevo en el proyecto** (patrón previo era lista única) — mayor riesgo de bugs en la detección de columna destino; mitigar con pruebas manuales en los 3 cruces posibles antes de dar la fase por cerrada.
- **Límite compartido `DASHBOARD_TASKS_LIMIT`** usado en dos sitios de `page.tsx` (línea de reorder y de visible) — verificar que el rename no deja un sitio con el valor viejo.
- **iOS**: si el drag debe iniciar con un gesto táctil, revisar que no choque con el scroll de la página (igual problema ya resuelto para tareas de producción, copiar la config exacta de sensors).
