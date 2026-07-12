---
phase: 1
title: "Backend: DTO de query + reescritura de findAll con SQL raw parametrizado"
status: done
---

## Context

- [products.service.ts:150-266](../../backend/src/modules/products/products.service.ts#L150-L266) — `findAll` actual (Prisma Client, `limit` default 20, sin filtros de fecha, sin orden de campos calculados).
- [create-product.dto.ts:339-376](../../backend/src/modules/products/dto/create-product.dto.ts#L339-L376) — `ProductsQueryDto` actual (search, category, supplier, isActive, stockStatus, sortBy, sortOrder, page, limit).
- [products.controller.ts:77-79](../../backend/src/modules/products/products.controller.ts#L77-L79) — controller solo pasa `query` al service, sin cambios de firma esperados.
- [prisma.service.ts:34-55](../../backend/src/common/services/prisma.service.ts#L34-L55) — middleware de soft-delete; **no aplica a `$queryRaw`**.
- Tablas relevantes: `products` (`deletedAt`), `categories` (`deletedAt`, self-join `parentId`→`parent.name`), `albaranes` (`deletedAt`, `date`), `albaran_lines` (`matchedProductId`, `albaranId`).

## Requirements

Extender `ProductsQueryDto` con:
- `categoryIds?: string` — CSV de ids de categoría (el frontend ya resuelve "padre incluye hijos" con el árbol que tiene cargado; el backend solo hace `IN (...)`).
- `dateField?: 'createdAt' | 'lastPurchaseDate'`, `dateFrom?: string`, `dateTo?: string` (ISO date).
- Ampliar el allowlist de `sortBy` para incluir: `name`, `purchasePrice`, `isActive`, `createdAt`, `lastPurchaseDate`, `realPrice`, `referencePrice`, `category` (nombre del padre), `subcategory` (nombre de la propia categoría). Cualquier valor fuera del allowlist → 400 o fallback a `name`.

Reescribir `findAll` para construir una query SQL parametrizada (`Prisma.sql` / `$queryRaw` con tagged template — nunca concatenación de strings) que:
1. Calcule `realPrice` = `purchasePrice / NULLIF(unitSize,0) / NULLIF(yieldFactor,0)`, `NULL` cuando no hay datos de merma (mismo criterio que `getRealPrice`: `(grossWeight IS NOT NULL AND netWeight IS NOT NULL) OR wastePercentage > 0`).
2. Calcule `referencePrice` = `purchasePrice / NULLIF(unitSize,0)`.
3. Calcule `lastPurchaseDate` = `GREATEST(manualPurchaseDate, (SELECT MAX(a.date) FROM albaran_lines al JOIN albaranes a ON a.id = al."albaranId" WHERE al."matchedProductId" = p.id AND a."deletedAt" IS NULL))`, con manejo de NULLs (usar `manualPurchaseDate` o la subquery cuando el otro es NULL — replicar `resolveLastPurchase`, no un `GREATEST` naive que falle con NULL).
4. Haga `LEFT JOIN categories c ON c.id = p."categoryId" AND c."deletedAt" IS NULL` y `LEFT JOIN categories parent ON parent.id = c."parentId" AND parent."deletedAt" IS NULL` para exponer `subcategoryName = c.name` y `parentCategoryName = COALESCE(parent.name, c.name)`.
5. Aplique `WHERE p."tenantId" = $1 AND p."deletedAt" IS NULL` + condiciones opcionales (search sobre name/description/barcode/brand con `ILIKE`, `categoryId = ANY($n)` si `categoryIds`, `supplierId`, `isActive`, `stockStatus`, rango de fecha sobre la columna elegida por `dateField`).
6. Ordene por la expresión SQL mapeada desde el allowlist de `sortBy` (mapa fijo `{ name: 'p.name', purchasePrice: 'p."purchasePrice"', realPrice: 'realPrice', ... }`), nunca por el string crudo del usuario.
7. Aplique `LIMIT $n OFFSET $n` para la página pedida.
8. Ejecute un segundo `$queryRaw`/`$queryRawTyped` de `COUNT(*)` con el mismo WHERE (sin LIMIT/OFFSET) para `meta.total`.
9. Después de traer los productos, siga usando Prisma Client normal para adjuntar relaciones ya existentes que no cambian (`purchaseFormats`, `nutritionalInfo`, `stocks`, `category`/`supplier` completos) — puede hacerse con una segunda query `findMany({ where: { id: { in: ids } } })` que preserve el orden ya calculado (reordenar en memoria por el array de ids, no confiar en el orden de retorno de Prisma).

## Files to modify

- `backend/src/modules/products/dto/create-product.dto.ts` — extender `ProductsQueryDto`.
- `backend/src/modules/products/products.service.ts` — reescribir `findAll`.

## Steps

1. Añadir campos nuevos al DTO con sus decoradores `class-validator` (`@IsOptional`, `@IsString`, `@IsIn` para `dateField`).
2. Escribir el mapa de allowlist `sortBy → expresión SQL` como constante privada del servicio.
3. Construir la query raw con `Prisma.sql`/`Prisma.join` para las condiciones dinámicas (evitar template strings manuales para el WHERE).
4. Ejecutar productos paginados + count en paralelo (`Promise.all`), igual que hoy.
5. Recuperar relaciones completas vía Prisma Client para los ids obtenidos y reordenar en memoria según el orden de la query raw.
6. Mantener la forma de respuesta actual: `{ success, data, meta: { total, page, limit, totalPages }, message }`.

## Tests / Validation

- Un tenant con >20 productos: pedir `page=2` y confirmar que trae productos distintos a `page=1`.
- Ordenar por `realPrice` y `referencePrice` asc/desc y comparar manualmente contra 2-3 productos con mermas configuradas.
- Ordenar por `category` (debe agrupar por nombre del padre, no de la subcategoría).
- Filtrar por `dateField=lastPurchaseDate` con un producto que tiene compra por albarán y otro con `manualPurchaseDate`, confirmar que ambos casos entran/salen del rango correctamente.
- Soft-delete: borrar (soft) una categoría o un albarán usado en el cálculo y confirmar que no aparece/no afecta el resultado.
- Confirmar que un `sortBy` fuera del allowlist no rompe la query (fallback a `name`, no 500).

## Risks / Rollback

- Si la query raw resulta demasiado compleja de mantener, se puede aceptar el fallback ya descartado por el usuario (orden de campos calculados solo en la página actual) como plan B documentado aquí, no implementado salvo que se re-abra la decisión.
- Rollback: restaurar el `findAll` actual basado en Prisma Client (sin SQL raw); no hay migración de schema que revertir.
