# Fase 4 — Página global "Histórico de precios"

No existe hoy: solo hay vista de historial por artículo individual
(`ProductPriceHistoryTable`, requiere `productId`). Se construye una vista
tenant-wide nueva.

## Backend
- `backend/src/modules/products/products.controller.ts`: nuevo
  `GET /v1/products/price-history/all` (roles ADMIN/USER/VIEWER), query
  `page`, `limit`, `productId?`, `supplierId?`.
- `backend/src/modules/products/products.service.ts`: nuevo método
  `getAllPriceHistory(tenantId, { page, limit, productId?, supplierId? })`
  — `prisma.productPriceHistory.findMany` con `skip/take`, `orderBy:
  { recordedAt: 'desc' }`, `include: { product: { select: { id, name } },
  supplier: { select: { id, name } }, albaran: { select: { id,
  internalNumber, albaranNumber } } }` + `count` en paralelo para el total.

## Frontend
- `frontend/src/hooks/use-price-history.ts` (nuevo): `useAllPriceHistory(page,
  limit, filters)` vía `useApiQuery`.
- `frontend/src/app/dashboard/historico-precios/page.tsx` (nuevo): tabla con
  columnas Fecha / Producto / Proveedor / Anterior / Nuevo / Variación /
  Albarán, paginación simple (prev/next), usando los tokens de diseño ya
  vigentes en el dashboard (`tonal-layer-2`, `text-on-surface-variant`,
  `font-label-md`, etc. — NO el estilo `text-gray-500` legacy de
  `product-price-history-table.tsx`).
- Si el archivo de la tabla supera ~200 líneas, separar en
  `frontend/src/app/dashboard/historico-precios/components/price-history-table.tsx`.
- Reutilizar `normalizePrice`/`referencePriceChanged`/`formatRefPrice` de
  `frontend/src/hooks/use-products.ts` para el cálculo de variación (mismo
  criterio que la tabla por artículo).

## Validación
- Página carga sin `productId` previo, pagina correctamente, cada fila
  enlaza al artículo/albarán correspondiente.
