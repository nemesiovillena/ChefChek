# Fase 03: Backend — wiring flujo manual (`ManualAlbaranService` + DTO)

**Estado: ✅ implementada, con desviación respecto al diseño original.** El code review detectó que el emparejamiento por índice (`albaran.lines[index]` tras `include: { lines: true }`) no tenía garantía de orden en Prisma/Postgres — riesgo real de vincular `Lot.albaranLineId` a la línea equivocada. Se rediseñó: en vez de `lines: { create: [...] }` + re-fetch, cada `AlbaranLine` se crea individualmente dentro del bucle de la 3ª pasada, capturando su `id` real al momento. Sin spec previo para este servicio (confirmado, no existía).

## Contexto
`backend/src/modules/albaranes/services/manual-albaran.service.ts` crea el albarán manual completo en una sola pasada (`prisma.albaran.create` con `lines: { create: [...] }`, líneas 197-225) y luego, en una 3ª pasada separada (líneas 229-265), crea los `stockMovement`/`stock` por línea. A diferencia del flujo OCR, este NO pasa por `AlbaranStockService` — es un camino independiente que hay que cablear por separado.

**Detalle importante**: el `albaran.create` de la 2ª pasada (línea 197) no incluye `include: { lines: true }`, así que el objeto `albaran` devuelto no trae los `id` de las líneas creadas — necesarios para `Lot.albaranLineId`. Hay que añadir ese include.

## Archivos a modificar
- `backend/src/modules/albaranes/dto/manual-albaran.dto.ts`
- `backend/src/modules/albaranes/services/manual-albaran.service.ts`

## Implementación

### 1. DTO — `manual-albaran.dto.ts`
En `ManualAlbaranLineDto` (líneas 13-41), añadir:
```ts
  @IsOptional()
  @IsString()
  lot?: string;
```

### 2. Servicio — creación de producto (líneas 161-179)
Añadir `lot: line.lot || null` al `data` de `product.create`. Aplica solo a la rama de producto nuevo (líneas 150-182); la rama de producto existente por nombre (líneas 132-149) no toca `lot` — decisión consistente con fase 02 (solo se actualiza `Product.lot` cuando la línea de la que proviene tiene lote informado; si `existingByName` y `line.lot` está presente, replicar el mismo patrón que fase 02: `product.update({ data: { lot: line.lot } })` condicionado a `line.lot` truthy).

### 3. Servicio — incluir ids de línea al crear el albarán (línea 197)
```ts
const albaran = await this.prisma.albaran.create({
  data: { /* ...igual que ahora... */ },
  include: { lines: true },
});
```

### 4. Servicio — 3ª pasada, vincular `line.lot` original con la `AlbaranLine` creada
`processedLines` (línea 185, `{ line, productId }`) contiene la línea de entrada (`ManualAlbaranLineDto`, sin id de BD) — no la `AlbaranLine` creada. Emparejar por índice con `albaran.lines` (mismo orden que `processedLines.map(...)` en la creación, línea 211) para obtener el `albaranLineId` real:

```ts
for (const [index, { line, productId }] of processedLines.entries()) {
  if (!productId || line.quantity <= 0) {
    continue;
  }
  const createdLine = albaran.lines[index];

  const movement = await this.prisma.stockMovement.create({
    data: {
      productId,
      type: "ENTRANCE",
      quantity: line.quantity,
      unit: line.unit,
      reason: `Entrada albarán manual ${internalNumber} [${albaran.id}]`,
    },
  });

  if (line.lot) {
    const lot = await this.lotService.createLotFromReception(this.prisma, {
      tenantId,
      productId,
      albaranLineId: createdLine.id,
      lotNumber: line.lot,
      quantity: line.quantity,
      supplierId,
    });
    if (lot) {
      await this.prisma.stockMovement.update({
        where: { id: movement.id },
        data: { lotId: lot.id },
      });
    }
  }

  // ...resto del bloque de stock igual que hoy (líneas 244-263)
}
```

Nota: `LotService.createLotFromReception` recibe `Prisma.TransactionClient` en su firma (fase 01) — `this.prisma` (un `PrismaService` normal, no una tx) es estructuralmente compatible porque `PrismaService` expone los mismos métodos de modelo; si TypeScript se queja por el tipo exacto, ajustar la firma del método a aceptar `Prisma.TransactionClient | PrismaService` o tipar como `any` acotado — decidir en implementación, no bloquea el diseño.

### 5. Inyectar `LotService` en el constructor de `ManualAlbaranService`

## Tests / validación
- Test manual: crear un albarán manual con una línea con `lot` relleno vía `POST /v1/albaranes/manual`, verificar `Lot` creado y `stockMovement.lotId` enlazado.
- Si existe `manual-albaran.service.spec.ts`, añadir casos equivalentes a fase 02.
- `npm run build` sin errores de tipos.

## Riesgos y rollback
- Riesgo: este flujo NO corre dentro de una `$transaction` global (a diferencia de `processStockOnConfirmation`) — si falla la creación del `Lot` a mitad de la 3ª pasada, las líneas ya procesadas antes quedan con stock actualizado pero sin lote en las siguientes iteraciones fallidas. Este riesgo de atomicidad ya existe hoy en el código (sin transacción en la 3ª pasada) — no se introduce nuevo riesgo, pero tampoco se corrige aquí (fuera de alcance de este plan; si se quiere envolver en `$transaction`, tratarlo como cambio aparte).
- Rollback: revertir el commit de esta fase.
