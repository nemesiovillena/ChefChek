---
phase: 4
title: 'Frontend: pantalla "Permisos por rol"'
status: completed
priority: P2
dependencies:
  - 3
---

# Phase 4: Frontend — pantalla "Permisos por rol"

## Overview

Nueva sección en Configuración (`/dashboard/settings`) visible solo para OWNER/ADMIN: matriz USER × VIEWER de apartados activos del tenant, con sub-opciones de Recetas y Producción, que lee y guarda vía `GET/PUT /api/v1/role-access`.

## Requirements

- Funcional: OWNER/ADMIN ve la sección; USER/VIEWER no la ve (ni la ruta ni el contenido).
- Funcional: dos columnas (USER / VIEWER); una fila por apartado que el tenant tiene **activo**; filas hijas indentadas para `recipes.cost/ficha/edit` y `production.tasks`.
- Funcional: desmarcar el padre (`recipes`) deshabilita/atenúa sus hijos (si no ve Recetas, los sub-flags son irrelevantes) — el backend ya lo resuelve, pero la UI debe reflejarlo.
- Funcional: "Guardar" hace `PUT` con el mapa completo de ambos roles; feedback de éxito/error; estado dirty.
- No-funcional: M3 sobrio, coherente con el resto de Configuración; sin `confirm()` nativo (usar patrón `useConfirm` si hace falta descartar cambios).

## Architecture

### Ubicación

- `frontend/src/app/dashboard/settings/page.tsx` — añadir tab/sección "Permisos por rol" (revisar cómo está seccionada la página: tabs, acordeón o lista). Componente nuevo en `frontend/src/app/dashboard/settings/components/role-access-panel.tsx`.
- Gate: `const { user } = useAuth(); if (!['OWNER','ADMIN'].includes(user?.role ?? '')) return null;` para la sección. (La ruta `/dashboard/settings` sigue abierta; solo se oculta el panel.)

### Datos

- `frontend/src/features/modules/api/role-access-api.ts` (creado en Phase 3) → añadir:
  - `fetchRoleAccessConfig(): Promise<{ sections: SectionDef[]; USER: Record<string,boolean>; VIEWER: Record<string,boolean> }>` → `GET /api/v1/role-access`.
  - `saveRoleAccess(payload: { USER: Record<string,boolean>; VIEWER: Record<string,boolean> }): Promise<void>` → `PUT /api/v1/role-access`.
- `SectionDef` = `{ key, label, parent?, moduleId? }` (el backend ya filtra por módulos activos).
- Hook local en el panel: `useState` para `draft` (mapa por rol), `dirty`, `saving`. Carga inicial imperativa vía handler (no `useEffect`; patrón del proyecto — o `useSuspenseQuery` si el resto de settings lo usa; alinear con lo existente).

### UI

```
┌ Permisos por rol ─────────────────────────────────────────┐
│  Define qué ve cada rol en este cliente. No afecta a       │
│  administradores.                            [Guardar]     │
│                                                            │
│  Apartado                            USER      VISOR       │
│  ─────────────────────────────────────────────────────     │
│  Recetas                             [x]        [x]        │
│    └ Ver coste                       [ ]        [ ]        │
│    └ Ver ficha técnica               [ ]        [ ]        │
│    └ Editar recetas                  [x]        [ ]        │
│  Producción                          [ ]        [ ]        │
│    └ Ver tareas de preparación       [x]        [ ]        │
│  Almacén / Stock                     [ ]        [ ]        │
│  Compras                             [ ]        [ ]        │
│  Equipo                              [ ]        [ ]        │
│  Notificaciones de Sala              [x]        [x]        │
│  Asistente IA                        [x]        [x]        │
│  Histórico de precios                [ ]        [ ]        │
│  Papelera                            [ ]        [ ]        │
│  ...                                                       │
└────────────────────────────────────────────────────────────┘
```

- Checkbox: componente ya usado en settings (revisar; si hay un `Switch`/`Checkbox` M3 en `components/ui`, reutilizar).
- Fila hija: `pl-6` + label más tenue; deshabilitada visualmente si el padre está desmarcado para esa columna (`opacity-50`, `disabled`), pero conservar su valor en el `draft`.
- **Columna VIEWER** (decisión validación #5): nota bajo el encabezado — "El visor es siempre solo-lectura; aquí solo eliges qué apartados ve". El sub-check `Editar recetas` en la columna VIEWER se muestra deshabilitado/oculto (no aplica).
- Descartar cambios al salir con `dirty`: `useConfirm()` (M3, ver memoria `m3-destructive-dialog-replaces-native-confirm`).

## Related Code Files

- Create: `frontend/src/app/dashboard/settings/components/role-access-panel.tsx`
- Modify: `frontend/src/app/dashboard/settings/page.tsx` (montar el panel para OWNER/ADMIN)
- Modify: `frontend/src/features/modules/api/role-access-api.ts` (fns de config completa)
- Reference: panel de módulos del superadmin (`frontend/src/features/superadmin/...`) para el patrón visual de toggles

## Implementation Steps

1. Revisar estructura de `settings/page.tsx` (tabs vs secciones) y cómo cargan datos otras secciones.
2. API: `fetchRoleAccessConfig` + `saveRoleAccess`.
3. `role-access-panel.tsx`: carga, matriz, estado dirty, guardar, feedback.
4. Montar en `settings/page.tsx` con gate OWNER/ADMIN.
5. Descartar-cambios con `useConfirm`.
6. Probar en navegador: como ADMIN cambiar flags de USER, recargar, verificar persistencia; como USER confirmar que la sección no aparece.
7. `bun run build` frontend.

## Success Criteria

- [ ] OWNER/ADMIN: sección "Permisos por rol" visible en Configuración con la matriz de apartados activos.
- [ ] Cambiar checks + Guardar ⇒ `PUT` 200; al recargar, los valores persisten.
- [ ] Desmarcar "Recetas" para USER ⇒ sus 3 hijos quedan atenuados/disabled.
- [ ] USER/VIEWER: la sección no se renderiza.
- [ ] Tras guardar, al re-navegar el dashboard del rol afectado refleja los cambios (via `refetch` de `useSectionAccess`).
- [ ] `bun run build` frontend verde; sin `useEffect` directo nuevo.

## Risk Assessment

- **Eststructura de settings desconocida**: paso 1 puede requerir adaptación (tabs vs secciones). Bajo riesgo.
- **Lista larga de apartados**: mantener orden = orden de `NAV_GROUPS` para familiaridad; agrupar por los mismos títulos (Cocina / Almacén / APPCC / Contenido / Herramientas) si ayuda.
- **Sincronía de efecto**: el rol afectado solo ve el cambio tras `refetch`; documentar en la propia UI ("los cambios se aplican en la próxima carga del usuario").

<!-- Updated: Validation Session 1 (2026-08-30) — decisiones: Proveedores casilla propia, Escandallos casilla propia, clic tarea no navega, tareas solo ver+completar, VIEWER siempre RO, transversales incluidos, efecto en recarga. Ver plan.md ## Validation Log. -->
