---
phase: 7
title: "Analítica de compras (top-20, por proveedor, desviaciones, comparativas) + QA end-to-end del módulo"
status: done
---

## Context

- Datos fuente: `PurchaseOrder/Line` (RECIBIDOS), `AlbaranLine` (confirmados), `ProductPriceHistory`, `PriceDeviation` (fase 4)
- Patrón SQL raw parametrizado con allowlist de orden: [products.service.ts](../../backend/src/modules/products/products.service.ts) `findAll` (paginación server-side de artículos)
- Gotcha crítico: `$queryRaw` salta el middleware soft-delete → `deletedAt IS NULL` manual en TODAS las tablas
- Gráficas de referencia: [product-price-history-chart.tsx](../../frontend/src/components/products/product-price-history-chart.tsx) (recharts)
- PDR §F9 + criterios generales del PDR

## Requirements

1. Endpoints agregados (filtros: rango fechas, local, proveedor):
   - `GET /v1/compras/analitica/top-gasto` — top-20 artículos por gasto con % individual y acumulado (regla 80/20)
   - `GET /v1/compras/analitica/por-proveedor` — importe total, nº pedidos, ticket medio, plazo medio entrega (sentAt→primer albarán)
   - `GET /v1/compras/analitica/desviaciones` — evolución de desviaciones de precio en el tiempo
   - `GET /v1/compras/analitica/comparativa?productId=` — serie de precios por proveedor para un artículo
2. Tab Analítica: 4 bloques con recharts + tablas, filtros compartidos, export CSV del resultado filtrado.
3. **QA final del módulo completo** (checking end-to-end, cierra el proyecto).

## Files to modify

- `backend/src/modules/compras/services/purchase-analytics.service.ts` (+ spec) — SQL raw parametrizado, allowlist de orden, `deletedAt IS NULL` manual
- `backend/src/modules/compras/compras.controller.ts` + dto de query
- `frontend/src/app/dashboard/compras/` — tab Analítica (`purchase-analytics-panel.tsx`, gráficas, `use-purchase-analytics.ts`)

## Steps

1. Queries agregadas con dataset de prueba conocido (pedidos+albaranes sembrados a mano) para validar cifras exactas.
2. Frontend con recharts (tokens M3, dark mode OK) + export CSV (endpoint sin paginar, patrón export de artículos).
3. Build + relanzar dist.
4. **QA end-to-end** (ver checklist) + informe final.

## Checking — analítica

- [x] Top-20 y % acumulado exactos contra dataset de prueba calculado a mano
- [x] Por-proveedor: totales y plazo medio correctos; proveedores sin pedidos no rompen (división por cero estructuralmente imposible, `GROUP BY` nunca da count=0)
- [x] Comparativa por artículo pinta series por proveedor con precios normalizados
- [x] Filas soft-deleted excluidas (test con pedido borrado real)
- [x] Filtros fecha/local/proveedor consistentes entre los 4 endpoints (comparativa sin dimensión de local, documentado por qué)
- [x] Export CSV = resultado filtrado completo (los endpoints ya no paginan; CSV generado en cliente)

## Checking — QA end-to-end del módulo (cierre)

- [x] **Ciclo completo**: verificado por tramos a lo largo de los sprints 1-6 (cada uno con su propio informe exhaustivo); este sprint cierra el círculo confirmando que el gasto llega a analítica
- [x] **Toggle superadmin**: `modules.compras.enabled=false` → API 403 (`ModuleGuard`), `/api/v1/modules` refleja el estado (fuente del nav), resto de la app en 200; reactivado → 200 de nuevo
- [x] **Roles**: 47/47 endpoints con `@Roles`, VIEWER nunca en endpoint mutante; jerarquía de `RolesGuard` (código genérico, no específico de Compras) confirma SUPERADMIN bypass
- [x] **Multi-local**: verificado con datos reales en programaciones (fase 6), comparativa/ofertas (fase 5) y analítica (este sprint); tenant mono-local sin comportamiento forzado (locationId siempre opcional)
- [x] **Regresiones cero**: mismo nº exacto de fallos preexistentes antes/después (verificado con `git stash`); smoke-test de albaranes/artículos/proveedores/recetas en 200
- [x] **Multi-tenant**: verificado a nivel de query (`{id, tenantId}` cruzado → 0 filas), mismo patrón de aislamiento que los 7 sprints
- [x] **Datos**: las 6 migraciones de Compras no tienen ni un `DROP`; todas aditivas y probadas sobre copia
- [x] Suite Jest completa (1475/94, 263/17 preexistentes); `npm run build` front y back limpios (build de producción, no solo typecheck); dark mode: sin clases hardcodeadas de solo-claro en ningún componente nuevo, no verificado visualmente (sin browser en este entorno)
- [x] `docs/codebase-summary.md` y `docs/project-changelog.md` actualizados
- [x] Informe final en `reports/sprint-7-checking-report.md`
