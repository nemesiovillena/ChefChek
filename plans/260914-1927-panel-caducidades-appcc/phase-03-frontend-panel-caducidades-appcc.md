---
phase: 3
title: Frontend panel caducidades APPCC
status: completed
priority: P2
dependencies:
  - 1
---

# Phase 3: Frontend — panel de gestión de caducidades bajo APPCC

## Overview

Página nueva bajo el grupo de navegación APPCC que lista `FoodLabel`
(ELABORATED + HANDLED, con filtro) con lote, creación, caducidad y estado
visual (rojo si `expiring_soon`/`expired`). Cada fila enlaza a la ficha de
detalle/trazabilidad **ya existente** (`/dashboard/etiquetado/[id]`) — no se
duplica esa vista.

## Requirements

- Funcional: ruta `/dashboard/appcc/caducidades`, entry nueva en el nav bajo
  el grupo "APPCC" (`frontend/src/features/modules/lib/nav-config.ts:75-81`).
- Funcional: toggle de filtro `Todos / Elaboraciones / Artículos manipulados`
  sobre `labelType` (ambos incluidos por defecto — decisión ya tomada, no
  exclusivo).
- Funcional: tabla con columnas — nombre (`itemName`), tipo, lote
  (`lotNumber`), creación (`preparedAt`), caducidad
  (`frozenUseByDate ?? useByDate`), estado. Estado en rojo
  (`text-error`/`bg-error`, mismo token que `pedidosPendientesCard` en el
  dashboard, NO color hardcodeado) cuando `expiryStatus !== 'ok'`; distinguir
  visualmente `expiring_soon` (aviso) de `expired` (más énfasis).
- Funcional: fila clicable → `/dashboard/etiquetado/{id}`.
- Funcional: excluir labels anuladas por defecto (`includeVoided` no se
  activa desde este panel — es del histórico de `/dashboard/etiquetado`, no
  de este).
- No funcional: paginación server-side reusando `ListFoodLabelsDto` extendido
  en fase 1 — no traer todo el listado al cliente (mismo patrón ya usado en
  Artículos/Recetas, ver `articulos-server-side-pagination-and-computed-sort`
  en memoria del proyecto).

## Architecture

**Gotcha de módulos — leer antes de tocar nav:** la ruta cuelga de
`/dashboard/appcc/...` pero los datos son del módulo backend `etiquetado`
(`@RequireModule("etiquetado")` en `etiquetado.controller.ts`), no de
`appcc`. `ROUTE_MODULE_MAP` (`nav-config.ts:115-134`) resuelve por prefijo
más específico primero — si no se añade una entrada explícita para
`/dashboard/appcc/caducidades`, heredará el prefijo genérico
`/dashboard/appcc` → módulo `appcc`, lo que permitiría a un tenant con
`appcc` activo pero `etiquetado` desactivado ver el nav item y que las
llamadas a `/api/v1/etiquetado/*` devuelvan 403. **Añadir una entrada
específica** `{ prefix: '/dashboard/appcc/caducidades', moduleId: 'etiquetado'
}` **antes** de la entrada genérica de `/dashboard/appcc` en el array (el
comentario del archivo ya avisa: "Ordered so longer/more-specific prefixes
are matched first"). El nav item en sí también debe usar
`moduleId: 'etiquetado'`, no `'appcc'`.

Reusar íntegramente los tipos y hooks de `frontend/src/hooks/use-food-labels.ts`
(`useFoodLabels`, `FoodLabel`, `FoodLabelListQuery`) — no crear un hook
paralelo. Extender ahí mismo (no en un archivo nuevo):
- `FoodLabelListQuery`: `expiringWithinDays?: number; sortBy?: 'preparedAt' | 'useByDate';`
- `FoodLabel`: `daysUntilExpiry: number; expiryStatus: 'ok' | 'expiring_soon' | 'expired';`

## Related Code Files

- Create: `frontend/src/app/dashboard/appcc/caducidades/page.tsx` — página
  `'use client'` (mismo patrón que `appcc/page.tsx` y `etiquetado/page.tsx`),
  auth redirect igual que las páginas hermanas. Si supera ~200 líneas, extraer
  la tabla a un componente propio bajo la misma carpeta (regla de
  modularización del proyecto).
- Modify: `frontend/src/hooks/use-food-labels.ts` — extender `FoodLabel` y
  `FoodLabelListQuery` con los campos de la fase 1.
- Modify: `frontend/src/features/modules/lib/nav-config.ts` — nav item bajo
  "APPCC" (línea ~75-81) + entrada en `ROUTE_MODULE_MAP` (línea ~115-134, ver
  gotcha arriba).
- Reference (no modificar): `frontend/src/app/dashboard/etiquetado/[id]/page.tsx`
  — destino del link de cada fila.
- Reference (no modificar): `frontend/src/app/dashboard/appcc/page.tsx` —
  convenciones de layout/loading/auth-redirect a replicar.

## Implementation Steps

1. Extender tipos/hook en `use-food-labels.ts` (campos de fase 1).
2. Crear la página con estado local de filtro (`labelType` toggle), llamada a
   `useFoodLabels({ expiringWithinDays: undefined, sortBy: 'useByDate', ...filtro, page, pageSize })`
   — sin `expiringWithinDays` fijo: el panel muestra TODO por defecto,
   ordenado por caducidad más próxima primero; el filtro de "solo próximas a
   caducar" es un toggle adicional opcional, no el modo por defecto (el
   panel es de gestión/consulta, no solo de alertas).
3. Tabla con `Badge`/clases de color por `expiryStatus` (reusar componentes
   `Card`/`Badge`/tabla ya existentes en el proyecto, no crear primitivos
   nuevos).
4. Paginación server-side (mismo patrón que Artículos/Recetas).
5. Nav entry + `ROUTE_MODULE_MAP` entry.
6. Verificar acceso: usuario con módulo `etiquetado` desactivado no debe ver
   el nav item ni poder navegar directo a la URL.

## Success Criteria

- [ ] Panel accesible desde el nav bajo APPCC, lista ELABORATED y HANDLED con
      filtro funcional.
- [ ] Columnas correctas; caducidad usa `frozenUseByDate ?? useByDate`.
- [ ] Filas con `expiryStatus !== 'ok'` muestran texto/badge en rojo
      (`text-error`), sin color hardcodeado.
- [ ] Click en fila navega a `/dashboard/etiquetado/{id}` y esa ficha carga
      bien (ya existente, no debe romperse).
- [ ] Con módulo `etiquetado` desactivado: nav item oculto y acceso directo a
      `/dashboard/appcc/caducidades` bloqueado (no un 500, un redirect/guard
      limpio, igual que otras rutas gateadas).
- [ ] Paginación server-side operativa (no se cargan 500 labels de golpe).
- [ ] `bun run build` frontend sin errores de tipos.

## Risk Assessment

- **Confusión de módulo** (ver Architecture): si se omite la entrada
  específica en `ROUTE_MODULE_MAP`, el bug es silencioso (nav visible, API
  403) — verificar explícitamente en pruebas manuales con un tenant que solo
  tenga `appcc` activo, no `etiquetado`.
- **Volumen de datos**: cocinas con alta rotación de etiquetas pueden acumular
  muchas filas — la paginación server-side ya prevista cubre esto; no cargar
  `pageSize` alto por defecto.
