---
phase: 7
title: "Analítica de compras (top-20, por proveedor, desviaciones, comparativas) + QA end-to-end del módulo"
status: pending
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

- [ ] Top-20 y % acumulado exactos contra dataset de prueba calculado a mano
- [ ] Por-proveedor: totales y plazo medio correctos; proveedores sin pedidos no rompen (división por cero)
- [ ] Comparativa por artículo pinta series por proveedor con precios normalizados
- [ ] Filas soft-deleted excluidas (test con producto/pedido borrado)
- [ ] Filtros fecha/local/proveedor consistentes entre los 4 endpoints
- [ ] Export CSV = resultado filtrado completo, no la página visible

## Checking — QA end-to-end del módulo (cierre)

- [ ] **Ciclo completo**: crear lista → generar pedido → enviar (email real + wa.me) → recibir albarán vinculado → conciliar → desviación de pactado notificada → visible en analítica
- [ ] **Toggle superadmin**: desactivar Compras en el tenant → nav oculto, `/dashboard/compras` redirige, API 403, resto de la app intacto; reactivar → todo vuelve
- [ ] **Roles**: VIEWER solo lectura; USER/ADMIN/OWNER operan; SUPERADMIN bypass
- [ ] **Multi-local**: pedido/lista/programación/analítica filtradas por local; tenant mono-local no nota nada
- [ ] **Regresiones cero**: flujo albaranes completo, artículos (listado/paginación/precios), proveedores, recetas/escandallos — re-probados
- [ ] **Multi-tenant**: curl cruzado entre tenants → 403/404 en todos los recursos nuevos
- [ ] **Datos**: ninguna migración del proyecto destruyó datos (counts pre/post por tabla afectada)
- [ ] Suite Jest completa backend pasa; `npm run build` front y back limpios; dark mode revisado en todas las vistas nuevas
- [ ] Actualizar `docs/codebase-summary.md` (módulo Compras operativo, `orders` retirado) y `docs/project-changelog.md` si aplica
- [ ] Informe final en `reports/sprint-7-checking-report.md`
