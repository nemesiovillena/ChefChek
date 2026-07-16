# Fase 02: Backend — wiring flujo OCR/confirmación (`AlbaranStockService`)

**Estado: ✅ implementada.** Ambas ramas (producto existente / producto nuevo) crean `Lot` y enlazan `stockMovement.lotId`. `albaran-stock.service.spec.ts` arreglado (mock de `LotService` faltante, encontrado en code review) — 14/14 tests en verde.

## Contexto
`backend/src/modules/albaranes/services/albaran-stock.service.ts`, método `processStockOnConfirmation` (líneas 37-301). Itera `confirmedLines` (líneas del albarán con `lineStatus === CONFIRMADO`) y para cada una: (a) si `line.matchedProductId` existe → actualiza producto/stock (rama líneas 75-233), (b) si no → crea producto nuevo (rama líneas 234-289). Ambas ramas terminan creando un `stockMovement` y actualizando/creando `stock`. Ninguna de las dos toca `line.lot` hoy.

## Archivos a modificar
- `backend/src/modules/albaranes/services/albaran-stock.service.ts`

## Implementación

### 1. Inyectar `LotService`
Constructor (líneas 26-31): añadir `private readonly lotService: LotService` (import desde `./lot.service`).

### 2. Rama producto existente (matchedProductId) — tras `tx.stockMovement.create` (líneas 195-204)
Reemplazar ese bloque para capturar el movimiento creado y encadenar el lote:
```ts
const movement = await tx.stockMovement.create({
  data: {
    productId: product.id,
    warehouseId: albaran.warehouseId,
    type: "ENTRANCE",
    quantity: lineQuantity,
    unit: normalizeUnit(lineUnit),
    reason: `Entrada desde albarán ${albaran.internalNumber} (${albaranId})`,
  },
});

if (line.lot) {
  const lot = await this.lotService.createLotFromReception(tx, {
    tenantId,
    productId: product.id,
    albaranLineId: line.id,
    lotNumber: line.lot,
    quantity: lineQuantity,
    warehouseId: albaran.warehouseId,
    supplierId: albaran.supplierId,
  });
  if (lot) {
    await tx.stockMovement.update({
      where: { id: movement.id },
      data: { lotId: lot.id },
    });
  }
  await tx.product.update({
    where: { id: product.id },
    data: { lot: line.lot },
  });
}
```
(Actualiza `lotId` con un `update` posterior en vez de anidar la creación porque el `Lot` necesita `albaranLineId`/`productId` que ya se conocen, pero mantener el `create` de `stockMovement` simple y el enlace en un segundo paso evita reordenar toda la función. Alternativa más limpia: mover `lotService.createLotFromReception` ANTES del `stockMovement.create` y pasar `lotId: lot?.id ?? null` directamente en el `data` del create — preferible, aplicar así si no complica el diff.)

### 3. Rama producto nuevo (sin match) — en el `data` de `tx.product.create` (líneas 236-253) y tras `tx.stockMovement.create` (líneas 265-274)
- Añadir `lot: line.lot || null` al `data` de `product.create`.
- Igual que en el punto 2: crear el `Lot` (con `productId: newProduct.id`) y enlazar `lotId` en el `stockMovement` de esa rama.

## Tests / validación
- `backend/src/modules/albaranes/services/albaran-stock.service.spec.ts` (ya existe, usa fixtures con `lot: "L1"` según el scouting) — añadir/ajustar casos:
  - Línea con `matchedProductId` + `lot` → se crea `Lot`, `stockMovement.lotId` apunta a él, `product.lot` se actualiza.
  - Línea con `matchedProductId` sin `lot` → no se crea `Lot`, comportamiento idéntico al actual.
  - Línea nueva (sin match) + `lot` → producto nuevo con `lot` seteado, `Lot` creado.
- Ejecutar: `npm run test -- albaran-stock.service.spec.ts` (o el runner configurado en `backend/`).
- Prueba manual: confirmar un albarán con una línea con `lot` relleno vía API/UI, verificar en BD (`SELECT * FROM lots;`) y que `stock_movements.lotId` no es null.

## Riesgos y rollback
- Riesgo principal: `processStockOnConfirmation` corre dentro de una `$transaction` (línea 41) — cualquier error en la creación del `Lot` revertiría TODO el procesado de stock del albarán. Mitigado porque `createLotFromReception` es un `create` simple sin lógica que pueda fallar salvo datos inválidos (ya validados por el DTO).
- Rollback: revertir el commit de esta fase; no hay migración de datos que deshacer (fase 00 ya es reversible por separado).
