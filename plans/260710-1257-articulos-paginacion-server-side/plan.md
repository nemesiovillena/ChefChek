---
title: "Paginación y filtrado server-side para el listado de Artículos"
description: "Migrar búsqueda/filtro/orden/paginación de Artículos de cliente a servidor; hoy solo se ven 20 de N artículos porque el frontend nunca envía page/limit"
status: done
priority: P1
effort: 8h
branch: develop
tags: [backend, frontend, products, pagination]
created: 2026-07-10
---

## Overview

`useProducts()` → `usePaginatedQuery` ignora los parámetros `page`/`pageSize` ([use-api.ts:85-100](../../frontend/src/hooks/use-api.ts#L85-L100)); el frontend pide `GET /v1/products` sin query params y el backend aplica su default `limit=20` ([products.service.ts:158-159](../../backend/src/modules/products/products.service.ts#L158-L159)). Además, `articulos/page.tsx` filtra/ordena/exporta en memoria sobre ese subconjunto de 20 filas — búsqueda, categoría, proveedor, fechas y orden están rotos para cualquier tenant con más de 20 artículos.

Decisión del usuario: paginación server-side completa (opción B), con:
- UI de páginas numeradas (anterior/siguiente + números + selector de tamaño de página, default 25, elegible por el usuario).
- Orden SQL exacto también para los 3 campos calculados que hoy se ordenan en cliente (Precio Real, Precio Referencia, Categoría=nombre del padre) — no degradar a "solo ordena la página actual".

## Phases

| # | Phase | Status | Effort | Dependencies |
|---|-------|--------|--------|-------------|
| 1 | Backend: DTO de query + reescritura de `findAll` con SQL raw parametrizado (filtros, orden, paginación, campos calculados) | [x] | 3h | None |
| 2 | Backend: endpoint de exportación (todo el resultado filtrado, sin paginar) | [x] | 1h | Phase 1 |
| 3 | Frontend: hook `useProducts`/`usePaginatedQuery` — enviar filtros/orden/paginación reales, exponer `meta`, debounce de búsqueda | [x] | 1.5h | Phase 1 |
| 4 | Frontend: `articulos/page.tsx` — quitar filtro/orden en cliente, UI de paginación numerada + selector de tamaño, export contra endpoint dedicado | [x] | 2h | Phase 2, 3 |
| 5 | Validación end-to-end (filtros combinados, orden de campos calculados, export completo, regresión de subcategorías/fechas) | [x] | 0.5h | Phase 4 |

## Key Insights

- **Causa raíz confirmada**: no es solo un límite de UI — hoy el listado completo (búsqueda/orden/export) opera silenciosamente sobre 20 filas de N.
- **Campos calculados no son columnas**: `realPrice` (`purchasePrice/unitSize/yieldFactor`, null si no hay datos de merma), `referencePrice` (`purchasePrice/unitSize`) y el sort por "Categoría" (nombre de la categoría **padre**, vía `tree.find(parent => parent.children incluye categoryId)`) no existen como columnas — requieren SQL con expresiones/joins, no `orderBy` declarativo de Prisma.
- **`lastPurchaseDate` también es computado**: es el mayor entre `MAX(albaranLines.albaran.date)` y `manualPurchaseDate` (`resolveLastPurchase`). El filtro de fechas actual (`dateFilterType: 'createdAt' | 'lastPurchaseDate'`) debe reproducir esa misma lógica en SQL para el caso `lastPurchaseDate`.
- **Riesgo de soft-delete con SQL raw**: `$queryRaw` **no pasa** por el middleware de soft-delete de Prisma ([prisma.service.ts:34-55](../../backend/src/common/services/prisma.service.ts#L34-L55)) — hay que añadir `deletedAt IS NULL` a mano en `products`, `categories` y `albaranes` dentro de la query raw. Bug ya visto una vez en el módulo de papelera/soft-delete; no repetirlo.
- **Filtro de categoría "incluye subcategorías"**: hoy se resuelve en cliente con el árbol ya cargado (`subcategoryIdsForParent`). Más simple mantenerlo así: el frontend sigue resolviendo la lista de `categoryId`s a partir del árbol (que ya trae) y se la pasa al backend como `categoryIds` (lista), en vez de portar la jerarquía de categorías al backend.
- **Export debe cubrir todo lo filtrado, no solo la página visible**: al paginar de verdad, "exportar" ya no puede leer `sortedProducts` (solo la página actual) sin sorprender al usuario con un CSV de 25 filas cuando espera el listado completo filtrado. Se añade un endpoint/parámetro dedicado que reutiliza el mismo WHERE/ORDER BY sin LIMIT/OFFSET.
- **Prevención de inyección SQL**: `sortBy` no puede interpolarse directamente en el SQL raw (hoy ya es una key de objeto sin validar en Prisma `orderBy`, pero en raw SQL una interpolación directa sí sería inyectable). Todo `sortBy`/`sortOrder` debe resolverse contra un allowlist fijo (switch/mapa) a expresiones SQL predefinidas — nunca concatenar el valor del usuario.

## Dependency Graph

```
Phase 1 (backend query rewrite) ──┬──► Phase 2 (export endpoint)
                                    │
                                    └──► Phase 3 (frontend hook) ──► Phase 4 (UI) ──► Phase 5 (validación)
```

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| SQL raw olvida `deletedAt IS NULL` en alguna tabla | Media | Alto (filas borradas reaparecen) | Checklist explícito en Phase 1; test con un producto/categoría soft-deleted |
| Interpolación insegura de `sortBy`/`sortOrder` en SQL raw | Media | Alto (inyección SQL) | Allowlist obligatorio, nunca concatenar valores crudos del query param |
| Búsqueda dispara una request por tecla sin debounce | Alta | Medio (carga innecesaria, UI con parpadeo) | Debounce ~300ms en el input de búsqueda antes de disparar el query |
| Regresión en filtro de subcategorías (categoría padre incluye hijos) | Media | Medio | Mantener resolución en cliente vía árbol ya cargado; test manual con padre+hijos |
| Export ahora hace una request aparte (puede tardar con catálogos grandes) | Baja | Bajo | Reusar el mismo WHERE ya optimizado con índices existentes; no hay índice nuevo requerido para este alcance |

## Rollback Plan

- Phase 1-2: revertir a la `findAll` actual basada en Prisma Client (sin SQL raw) — no hay migración de esquema, solo lógica de servicio.
- Phase 3-4: revertir el hook y `page.tsx` a la versión actual (filtrado en cliente) — cambio de frontend puro, sin estado persistido que migrar.
- No hay cambios de schema/migración en este plan.
