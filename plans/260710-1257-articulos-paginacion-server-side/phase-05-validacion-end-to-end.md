---
phase: 5
title: "Validación end-to-end del listado paginado"
status: done
---

## Context

Cierre del plan: confirmar que la migración completa (backend + frontend) no regresiona ninguno de los filtros/orden/export existentes y que la paginación es correcta con datos reales del tenant de pruebas.

## Requirements

- Validar con el navegador real (no solo build/typecheck), siguiendo la regla del proyecto de probar el camino feliz y edge cases en UI antes de dar por cerrado un cambio de frontend.

## Checklist

- [ ] Listado muestra más de 20/50 artículos navegando páginas (usar tenant con >100 artículos si existe, o crear temporales de prueba).
- [ ] `meta.total`/`totalPages` coinciden con el conteo real filtrado.
- [ ] Cada combinación de filtro (búsqueda, categoría padre, subcategoría, proveedor, rango de fechas createdAt, rango de fechas lastPurchaseDate) devuelve el mismo resultado que el filtrado manual esperado.
- [ ] Orden asc/desc de cada `sortBy`, incluyendo los 3 calculados (`realPrice`, `referencePrice`, `category`).
- [ ] Búsqueda con debounce: no se dispara una request por cada carácter tecleado.
- [ ] Export CSV/Excel/PDF con un filtro activo trae el conjunto completo filtrado, no solo la página visible.
- [ ] Producto o categoría soft-deleted no aparece ni afecta órdenes/filtros calculados.
- [ ] Otros consumidores de `useCrud().useList` (categorías, recetas, usuarios) siguen funcionando igual tras el cambio en `usePaginatedQuery`.
- [ ] Ediciones inline existentes (fecha de última compra, toggle activo/inactivo, borrar) siguen refrescando la página actual correctamente tras `refetch()`.

## Risks / Rollback

- Si algún checklist falla, volver a la fase correspondiente (no parchear ad-hoc en Phase 5) — este phase es de verificación, no de implementación.
