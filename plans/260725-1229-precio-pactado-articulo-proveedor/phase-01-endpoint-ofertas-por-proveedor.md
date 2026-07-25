---
phase: 1
title: Endpoint ofertas por proveedor
status: completed
priority: P2
dependencies: []
effort: S
---

# Phase 1: Endpoint ofertas por proveedor

## Overview

Nuevo endpoint de solo lectura `GET /v1/products/suppliers/:id/offers` que liste las `ProductSupplierOffer` de un proveedor (con producto+precio actual+precio pactado), espejando `getSupplierProducts` pero leyendo la tabla de ofertas en vez del FK legacy `product.supplierId`. Sin endpoint de escritura nuevo — el `PATCH /v1/products/:productId/supplier-offers/:offerId` ya existente sirve para editar/limpiar `agreedPrice` desde la Fase 2 y 3.

## Key Insights

- `agreedPrice`/`agreedAt`/`agreedUntil` ya existen en `ProductSupplierOffer` (`backend/prisma/schema.prisma:257-294`). No crear campos nuevos.
- `GET /v1/products/suppliers/:id/products` (`products.controller.ts:520`, `products.service.ts:1414-1457`) usa `product.supplierId` (FK legacy) — no sirve, no trae `agreedPrice` ni cubre ofertas donde el proveedor no es el preferente.
- Convención del proyecto: los métodos de lectura "por proveedor" (`getSupplierProducts`, `getSupplierPriceTrend`, `getSupplierPriceHistory`) viven en `ProductsService` (`backend/src/modules/products/products.service.ts`) con acceso directo a `this.prisma`, no en `ProductSupplierOffersService`. Seguir esa convención para el método nuevo, por consistencia.
- Patrón de verificación ya usado en esos métodos (`products.service.ts:1420-1427`): `prisma.supplier.findFirst({ where: { id: supplierId, tenantId } })` → `NotFoundException` si no existe.
- **Gotcha de soft-delete en `include`:** el middleware de soft-delete de Prisma solo filtra el modelo top-level de la query (aquí `ProductSupplierOffer`), NO cascada automáticamente a relaciones incluidas (`include: { product: true }`). Si un producto fue soft-deleted, seguiría apareciendo en el resultado vía `include`. Filtrar explícito con `product: { deletedAt: null }` en el `where` (patrón ya usado para el mismo gotcha en recetas, ver memoria `recipe-save-fails-softdeleted-product`).
- `listOffers` (por producto, patrón de referencia) está en `backend/src/modules/products/product-supplier-offers.service.ts:37-43`: `findMany({ where: { productId, tenantId }, include: { supplier: true }, orderBy: [{ isPreferred: "desc" }, { createdAt: "asc" }] })`.

## Requirements

- Funcional: listar todas las ofertas (`ProductSupplierOffer`) de un proveedor, con datos del producto asociado (id, name, category) y todos los campos de precio (`purchasePrice`, `agreedPrice`, `agreedAt`, `agreedUntil`, `isPreferred`, `referenceUnit`, `referenceUnitSize`, `unitSize`, `purchaseFormat`, `unitsPerFormat`).
- No funcional: sin paginación (mismo criterio que `listOffers` por producto — lista corta, no justifica paginar). Debe excluir productos soft-deleted.

## Architecture

Controller (`ProductsController`) → `ProductsService.getSupplierOffers(supplierId, tenantId)` → Prisma directo. Respuesta con el mismo shape `{ success, data, message }` que el resto de endpoints de ofertas.

## Related Code Files

- Modify: `backend/src/modules/products/products.service.ts` — añadir método `getSupplierOffers` cerca de `getSupplierProducts` (línea ~1414).
- Modify: `backend/src/modules/products/products.controller.ts` — añadir endpoint `GET suppliers/:id/offers` cerca de `getSupplierProducts` (línea ~520), agrupado con las demás rutas `suppliers/:id/...`.

## Implementation Steps

1. En `products.service.ts`, añadir método:
   ```ts
   async getSupplierOffers(supplierId: string, tenantId: string) {
     const supplier = await this.prisma.supplier.findFirst({
       where: { id: supplierId, tenantId },
     });
     if (!supplier) {
       throw new NotFoundException(`Proveedor no encontrado`);
     }

     const offers = await this.prisma.productSupplierOffer.findMany({
       where: { supplierId, tenantId, product: { deletedAt: null } },
       include: { product: { include: { category: true } } },
       orderBy: [{ product: { name: "asc" } }],
     });

     return { success: true, data: offers, message: "Ofertas obtenidas" };
   }
   ```
2. En `products.controller.ts`, añadir endpoint junto a `getSupplierProducts`:
   ```ts
   @Get("suppliers/:id/offers")
   @Roles("ADMIN", "USER", "VIEWER")
   @ApiOperation({ summary: "Ofertas (precio pactado) de un proveedor" })
   @ApiParam({ name: "id", description: "ID del proveedor" })
   @ApiResponse({ status: 200, description: "Lista de ofertas" })
   async getSupplierOffers(@Param("id") id: string, @Req() req: any) {
     const tenantId = req.tenantId;
     return this.productsService.getSupplierOffers(id, tenantId);
   }
   ```
3. Verificar que `Product` tiene relación `category` (ya usada en `getSupplierProducts` línea 1438) — reusar tal cual, no verificar de nuevo si ya se confirma en el mismo archivo.
4. Compilar backend (`bun run build` o el comando de build/typecheck del proyecto) y arrancar/reiniciar el proceso `:3001` (el backend corre en modo `dist`, no watch — memoria `backend-dist-mode-not-watch`).
5. Probar con curl autenticado (memoria `api-testing-auth-session-tenant`): `GET /api/v1/products/suppliers/:id/offers` contra un proveedor con ofertas conocidas (ej. Bodegas Ruiz) y verificar que trae `agreedPrice`/`purchasePrice`/producto.

## Success Criteria

- [x] `GET /v1/products/suppliers/:id/offers` devuelve `{ success, data, message }` con `data` = array de ofertas + producto anidado. <!-- Verificado por code-reviewer (lectura de código) + test de controller (products.controller.spec.ts). Sin curl en vivo — restart de dist/main bloqueado por guardia local (scout-block.cjs). -->
- [x] Productos soft-deleted no aparecen en la respuesta. <!-- product: { deletedAt: null } confirmado en el where por code-reviewer -->
- [x] Proveedor inexistente/de otro tenant → 404. <!-- patrón findFirst({id,tenantId}) + NotFoundException idéntico a getSupplierProducts, confirmado por code-reviewer -->
- [x] `agreedPrice: null` se serializa como `null` (no se pierde ni se convierte a `0`). <!-- confirmado por code-reviewer -->

## Risk Assessment

- Bajo riesgo: endpoint de solo lectura, no toca escritura ni lógica de costeo/desviaciones existente.
- Riesgo real único: olvidar el filtro `product: { deletedAt: null }` y filtrar productos borrados en el frontend en su lugar (peor, expone datos que no deberían llegar al cliente). Filtrar en el `where` del backend, no en el cliente.
