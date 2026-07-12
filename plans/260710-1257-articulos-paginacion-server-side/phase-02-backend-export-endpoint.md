---
phase: 2
title: "Backend: endpoint de exportación (mismo filtro/orden, sin paginar)"
status: done
---

## Context

Con paginación real, "exportar" ya no puede leer la página cargada en el cliente (25 filas) cuando el usuario espera el listado completo filtrado — hoy `getExportData()` en [articulos/page.tsx:65-84](../../frontend/src/app/dashboard/articulos/page.tsx#L65-L84) usa `sortedProducts`, que tras Phase 4 será solo la página actual.

## Requirements

- Reutilizar exactamente el mismo WHERE/ORDER BY de Phase 1, sin `LIMIT`/`OFFSET`.
- No introducir una ruta ni lógica de filtrado nueva — es la misma query de `findAll` con paginación desactivada.

## Files to modify

- `backend/src/modules/products/products.service.ts` — añadir método (o parámetro `all: boolean` en `findAll`) que omite `LIMIT`/`OFFSET`.
- `backend/src/modules/products/products.controller.ts` — exponer el mismo `GET /v1/products` con un query param (`export=true` o similar) que active el modo sin paginar, en vez de una ruta nueva.

## Steps

1. En el service, si `query.export` (o `page`/`limit` ausentes con flag explícito) es true, omitir `LIMIT`/`OFFSET` en la query raw de Phase 1.
2. Cap de seguridad: si el total supera un umbral razonable (p.ej. 5000), seguir devolviendo todo pero documentar el límite práctico aquí — no añadir código de límite duro sin necesidad real (YAGNI) salvo que en Phase 5 se detecte un problema de rendimiento real.
3. Mantener `success`/`message`; `meta` puede omitir `totalPages`/`page` en este modo o reflejar el total real con `limit = total`.

## Tests / Validation

- Con los mismos filtros que un listado paginado, comparar que el export sin paginar contiene exactamente las mismas filas que recorrer todas las páginas manualmente.
- Verificar tiempo de respuesta aceptable con el volumen de artículos real del tenant de pruebas.

## Risks / Rollback

- Riesgo: catálogos muy grandes podrían hacer el export lento; no se optimiza preventivamente (sin evidencia de que sea un problema real) — revisar en Phase 5 si aparece.
- Rollback: quitar el flag `export`/parámetro y volver a exportar solo la página visible (regresión aceptada, no bloqueante).
