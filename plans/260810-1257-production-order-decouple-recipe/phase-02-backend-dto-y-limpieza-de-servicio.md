---
phase: 2
title: Backend DTO y limpieza de servicio
status: completed
priority: P1
dependencies:
  - 1
---

# Phase 2: Backend DTO y limpieza de servicio

## Overview

Actualizar `CreateProductionOrderDto` al nuevo contrato (título obligatorio, receta opcional, sin `ingredients`), reescribir `createProductionOrder` sin reserva de stock, y retirar como código muerto todo lo que solo servía a ese flujo (`reserveIngredient`, `convertToProductReferenceUnit`, `updateInventory`, dependencia de `WarehousesService`, `unit-conversion.util.ts`).

## Requirements

- Funcional: `POST /v1/production/orders` acepta `{ batchId, title, estimatedTime, recipeId?, recipeName?, quantity?, unit?, description? }`.
- No dejar código muerto (regla del proyecto: sin fallbacks/lógica para escenarios que ya no pueden ocurrir).
- Preservar el resto del módulo (mise en place, tareas, alertas, reportes) sin tocar su contrato.

## Architecture

`CreateProductionOrderDto` actual (`backend/src/modules/production/dto/production.dto.ts:74-95`):

```typescript
export class CreateProductionOrderDto {
  @IsString() batchId: string;
  @IsString() recipeId: string;
  @IsString() recipeName: string;
  @IsNumber() quantity: number;
  @IsString() unit: string;
  @IsNumber() estimatedTime: number;
  @IsArray() ingredients: ProductionIngredientDto[];
}
```

Nuevo contrato (`description` es un campo nuevo, distinto de `notes` — decisión explícita en Validation Log Session 1: `notes` se queda como está, sin exponerse en creación):

```typescript
export class CreateProductionOrderDto {
  @IsString() batchId: string;
  @IsString() title: string;
  @IsOptional() @IsString() recipeId?: string;
  @IsOptional() @IsString() recipeName?: string;
  @IsOptional() @IsNumber() quantity?: number;
  @IsOptional() @IsString() unit?: string;
  @IsNumber() estimatedTime: number;
  @IsOptional() @IsString() description?: string;
}
```

<!-- Updated: Validation Session 1 - campo `description` nuevo en vez de reutilizar `notes` -->


`ProductionIngredientDto` se elimina de `production.dto.ts` — sin la reserva de stock, nada la usa (verificar con grep tras el cambio, ver Implementation Steps).

`createProductionOrder` pasa de:
```typescript
for (const ingredient of dto.ingredients) {
  if (!ingredient.isAvailable) throw new BadRequestException(...);
  await this.reserveIngredient(tenantId, ingredient.productId, ingredient.quantity * dto.quantity, ingredient.unit);
}
// ...
data: { ..., recipeId: dto.recipeId, recipeName: dto.recipeName, items: dto.ingredients as any, ... }
```
a:
```typescript
// sin bucle de ingredientes
data: {
  tenantId, batchId: dto.batchId,
  title: dto.title,
  recipeId: dto.recipeId, recipeName: dto.recipeName,
  quantity: dto.quantity, unit: dto.unit,
  estimatedTime: dto.estimatedTime,
  orderNumber, orderType: "PREPARATION", status: "PENDING",
  scheduledFor: new Date(),
  description: dto.description,
  createdBy: userId,
}
```
(`items` deja de poblarse — el campo queda en el schema pero nadie escribe en él tras este cambio.)

`completeProductionOrder` (línea ~226) deja de llamar a `updateInventory` — se retira la llamada junto con el método.

`checkForDelays` (método privado, línea 835; el bloque de notificación citado está en ~878-884) usa `order.recipeName` para el mensaje de notificación — cambiar a `order.title` (siempre presente, a diferencia de `recipeName` que ahora es opcional). Actualizar también el parámetro `recipeName` de `NotificationsService.notifyProductionDelay` (`backend/src/modules/core/notifications.service.ts:94-109`) — renombrar a `orderTitle` para que el nombre refleje lo que realmente representa ahora.

## Related Code Files

- Modify: `backend/src/modules/production/dto/production.dto.ts` (DTO + retirar `ProductionIngredientDto`)
- Modify: `backend/src/modules/production/production.service.ts` (`createProductionOrder`, `completeProductionOrder`, `checkAndCreateDelayAlert`, retirar `reserveIngredient`/`convertToProductReferenceUnit`/`updateInventory`, retirar import de `convertQuantity` y `WarehousesService`)
- Modify: `backend/src/modules/production/production.module.ts` (retirar `WarehousesService`/`AlmacenesModule` del `imports` si nada más del módulo los usa — verificar primero)
- Modify: `backend/src/modules/core/notifications.service.ts` (renombrar parámetro `recipeName` → `orderTitle` en `notifyProductionDelay`, líneas 94-109)
- Delete: `backend/src/modules/production/utils/unit-conversion.util.ts` (confirmado sin otros importadores fuera de `production.service.ts` — re-verificar con grep antes de borrar)

## Implementation Steps

1. Reescribir `CreateProductionOrderDto` en `production.dto.ts` con el nuevo contrato; eliminar `ProductionIngredientDto`.
2. En `production.service.ts`:
   a. Quitar el bucle de `dto.ingredients`/`reserveIngredient` de `createProductionOrder`.
   b. Añadir `title: dto.title` y `description: dto.description` al `data` de creación; quitar `items: dto.ingredients as any`.
   c. Quitar la llamada a `await this.updateInventory(tenantId, orderId)` en `completeProductionOrder` (línea 208 en adelante).
   d. Borrar los métodos privados `reserveIngredient`, `convertToProductReferenceUnit`, `updateInventory`.
   e. Cambiar `order.recipeName` → `order.title` en la llamada a `notifyProductionDelay` dentro de `checkForDelays` (línea ~881).
   f. Quitar el import de `convertQuantity` (`./utils/unit-conversion.util`) y de `ProductionIngredientDto`.
   g. Quitar `warehousesService` del constructor y su import (`WarehousesService` de `../almacenes/almacenes.service`) — confirmar antes con `grep -n "warehousesService" production.service.ts` que no queda ningún otro uso.
3. En `production.module.ts`: quitar `AlmacenesModule` de `imports` si el grep del paso anterior confirma que ya no se inyecta `WarehousesService` en ningún provider del módulo.
4. Borrar `backend/src/modules/production/utils/unit-conversion.util.ts` tras confirmar con `grep -rln "unit-conversion.util" backend/src` que no queda ningún importador.
5. En `notifications.service.ts`, renombrar el parámetro `recipeName` a `orderTitle` en `notifyProductionDelay` (firma y cuerpo, líneas 94-109) — cambio interno, no rompe el contrato HTTP.
6. `npx tsc --noEmit` (o el comando de typecheck del proyecto) en `backend/` para confirmar que no quedan referencias rotas.

## Success Criteria

- [x] `CreateProductionOrderDto` no tiene `ingredients`; `recipeId`/`recipeName`/`quantity`/`unit` son `@IsOptional()`; `title` es obligatorio.
- [x] `grep -rn "reserveIngredient\|convertToProductReferenceUnit\|updateInventory\|ProductionIngredientDto" backend/src/modules/production/` no devuelve nada.
- [x] `grep -rn "WarehousesService" backend/src/modules/production/` no devuelve nada (ni el import, ni el constructor, ni el módulo).
- [x] `backend/src/modules/production/utils/unit-conversion.util.ts` no existe (borrado junto con su `.spec.ts`, sin otros importadores).
- [x] Typecheck del backend pasa sin errores.
- [x] `POST /v1/production/orders` con solo `{ batchId, title, estimatedTime }` crea la orden correctamente (verificado con curl real contra backend en dev).

## Risk Assessment

Riesgo principal: que `WarehousesService`/`AlmacenesModule` tengan otro uso no detectado en el research de este plan (el research solo encontró `reserveStock` en `reserveIngredient`) — el paso 2g exige re-verificar con grep antes de tocar el constructor, no asumir el hallazgo previo. Si el grep revela otro uso, mantener la inyección y solo retirar lo que de verdad quede muerto. Mismo criterio para `unit-conversion.util.ts` en el paso 4.
