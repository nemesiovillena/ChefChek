---
phase: 4
title: "Frontend: articulos/page.tsx — paginación numerada + filtros server-side + export completo"
status: done
---

## Context

- [articulos/page.tsx:330-448](../../frontend/src/app/dashboard/articulos/page.tsx#L330-L448) — `filteredProducts`/`sortedProducts` calculados en cliente sobre `products` (hoy solo 20-50 filas); pasan a ser innecesarios salvo la resolución de "categoría padre incluye hijos" (se mantiene, ver Phase 1 insight).
- [articulos/page.tsx:65-187](../../frontend/src/app/dashboard/articulos/page.tsx#L65-L187) — `getExportData`/`exportToCSV`/`exportToExcel`/`exportToPDF` leen `sortedProducts`; deben pasar a leer el resultado del endpoint de export completo (Phase 2).
- Decisión de usuario: páginas numeradas (anterior/siguiente + números) + selector de tamaño de página, default 25, elegible por el usuario (ej. 10/25/50/100).

## Requirements

- Estado de paginación (`page`, `pageSize`) además del estado de filtros ya existente; todo se pasa al hook de Phase 3.
- Al cambiar cualquier filtro, resetear `page` a 1 (evitar quedarse en una página vacía tras filtrar).
- `subcategoryIdsForParent` (resolución cliente de categoría padre → ids de hijos) se sigue calculando igual que hoy con el árbol ya cargado, pero el resultado se envía como `categoryIds` al backend en vez de filtrar el array local.
- Quitar `filteredProducts`/`sortedProducts` (cálculo en cliente) — la tabla renderiza directamente `products` (ya viene filtrado/ordenado/paginado del backend).
- Controles de paginación: anterior/siguiente, números de página (con elipsis si `totalPages` es grande), selector de tamaño de página.
- Exportar (CSV/Excel/PDF) dispara una request separada al modo "sin paginar" de Phase 2 con los filtros activos, no lee el estado paginado en memoria.

## Files to modify

- `frontend/src/app/dashboard/articulos/page.tsx` — estado de paginación, wiring de filtros al hook, quitar filtrado/orden en cliente, UI de paginación, export.
- Posible componente nuevo `frontend/src/app/dashboard/articulos/components/pagination-controls.tsx` si la UI de páginas numeradas + selector de tamaño no encaja limpia inline (evaluar tamaño antes de decidir extraer — no modularizar preventivamente).

## Steps

1. Añadir `const [page, setPage] = useState(1)` y `const [pageSize, setPageSize] = useState(25)`.
2. Resetear `page` a 1 en los `onChange` de `searchTerm`, `selectedParentCategory`, `selectedSubcategory`, `selectedSupplier`, `startDate`, `endDate`, `dateFilterType`.
3. Pasar `{ search: searchTerm, categoryIds: subcategoryIdsForParent/selectedSubcategory resuelto, supplier: selectedSupplier, dateField: dateFilterType, dateFrom: startDate, dateTo: endDate, sortBy: sortField, sortOrder: sortDirection, page, pageSize }` al hook de Phase 3.
4. Leer `productsData.data` (ya paginado) directamente para el render de la tabla; leer `productsData.meta` para pintar los controles de paginación.
5. Construir los controles de paginación (números + prev/next + selector de tamaño).
6. Reescribir `getExportData`/export* para llamar al endpoint sin paginar (Phase 2) con los filtros activos en el momento del click, y usar ese resultado en vez de `sortedProducts`.

## Tests / Validation

- Navegar entre páginas y confirmar que no se repiten ni saltan artículos (verificar contra `meta.total`).
- Cambiar un filtro estando en página 3 y confirmar que vuelve a página 1 automáticamente.
- Cambiar el selector de tamaño de página y confirmar que la página actual se recalcula sin salir del filtro activo.
- Exportar CSV/Excel/PDF con un filtro activo (ej. categoría) y confirmar que el archivo contiene TODOS los artículos que matchean, no solo los de la página visible.
- Verificar en navegador real (no solo tipos/build) que la tabla, el buscador y los filtros existentes (subcategoría encadenada, rango de fechas) siguen funcionando visualmente.

## Risks / Rollback

- Riesgo: UI de paginación mal alineada con el resto de tokens M3 del proyecto — revisar contra convenciones de diseño existentes en la página antes de dar por cerrado.
- Rollback: revertir `page.tsx` a la versión con filtro/orden en cliente (Phase 3 seguiría funcionando para otros consumidores del hook aunque esta página no la use).
