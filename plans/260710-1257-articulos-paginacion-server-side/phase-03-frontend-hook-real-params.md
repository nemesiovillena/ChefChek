---
phase: 3
title: "Frontend: useProducts/usePaginatedQuery envían filtros/orden/paginación reales"
status: done
---

## Context

- [use-api.ts:84-100](../../frontend/src/hooks/use-api.ts#L84-L100) — `usePaginatedQuery` recibe `page`/`pageSize` pero nunca los manda en la request (bug raíz de todo este plan).
- [use-products.ts:141-162](../../frontend/src/hooks/use-products.ts#L141-L162) — `ProductsQuery` interface ya define `category`, `supplier`, `isActive`, `search`, `page`, `pageSize`, pero `useProducts()` no los usa (`useList` los ignora también).

## Requirements

- `usePaginatedQuery`/`useCrud().useList` deben construir un querystring real con todos los filtros soportados por el backend de Phase 1: `search`, `categoryIds`, `supplier`, `isActive`, `stockStatus`, `dateField`, `dateFrom`, `dateTo`, `sortBy`, `sortOrder`, `page`, `limit`.
- La query key de TanStack Query debe incluir todos estos valores (para que cambiar un filtro dispare un refetch y cachee por combinación de filtros).
- `search` debe ir con debounce (~300ms) antes de entrar en la query key/params — evitar una request por tecla.
- Exponer `meta` (`total`, `page`, `limit`, `totalPages`) tal cual lo devuelve el backend, sin transformarlo.

## Files to modify

- `frontend/src/hooks/use-api.ts` — `usePaginatedQuery` construye querystring desde un objeto de params en vez de ignorarlos.
- `frontend/src/hooks/use-products.ts` — `useProducts(query, page, pageSize)` pasa `query` completo (no solo page/pageSize) al fetch; puede necesitar dejar de usar `useCrud().useList` genérico si este no soporta params arbitrarios, y construir su propio `useApiQuery` con querystring — decidir según cuánta lógica genérica de `useCrud` se reutiliza vs. cuánta es específica de productos.

## Steps

1. Extender `usePaginatedQuery` (o crear una variante) para aceptar un objeto de filtros y serializarlo a querystring (usar `URLSearchParams`, omitiendo valores `undefined`/vacíos).
2. Incluir el objeto de filtros completo en la `queryKey` (no solo `page`/`pageSize`) para que TanStack Query cachee correctamente por combinación.
3. Implementar debounce del término de búsqueda (hook `useDebouncedValue` local o `useDeferredValue`/`setTimeout` manual — usar lo más simple que ya exista en el repo si hay un patrón, si no, uno local sin dependencia nueva).
4. Confirmar que `Product`/`meta` tipados en `use-products.ts` siguen encajando con la respuesta ampliada del backend.

## Tests / Validation

- Confirmar en Network tab que `GET /v1/products` ahora incluye `page`, `limit` y los filtros activos.
- Cambiar de página y confirmar que la query key cambia y no se sirve de caché stale de otra página.
- Escribir rápido en el buscador y confirmar que solo se dispara una request al dejar de teclear (no una por carácter).

## Risks / Rollback

- Riesgo: si `useCrud` genérico se usa en otros módulos (albaranes, categorías, etc.), no romper su contrato — si se toca `usePaginatedQuery` compartido, verificar los demás consumidores de `useCrud().useList` antes de cambiar su firma.
- Rollback: revertir a `useList(page, pageSize)` sin params (vuelve el bug original, pero es un revert de un solo archivo).
