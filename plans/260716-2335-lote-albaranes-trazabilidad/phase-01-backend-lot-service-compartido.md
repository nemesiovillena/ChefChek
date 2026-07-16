# Fase 01: Backend — `LotService` compartido

**Estado: ✅ implementada.** `lot.service.ts` + registrado en `AlbaranesModule`. Se añadió además `lot.service.spec.ts` (sugerido por code review, no exigido originalmente).

## Contexto
`AlbaranStockService` (flujo OCR/confirmación) y `ManualAlbaranService` (flujo manual) son ambos providers de `AlbaranesModule` (`backend/src/modules/albaranes/albaranes.module.ts:26-27`). Para evitar duplicar la lógica de creación de `Lot` en los dos flujos (DRY), se extrae un servicio pequeño y compartido dentro del mismo módulo.

## Archivos a crear
- `backend/src/modules/albaranes/services/lot.service.ts`

## Archivos a modificar
- `backend/src/modules/albaranes/albaranes.module.ts` (registrar provider)

## Implementación

`lot.service.ts`:
```ts
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

interface CreateLotParams {
  tenantId: string;
  productId: string;
  albaranLineId: string;
  lotNumber: string;
  quantity: number;
  warehouseId?: string | null;
  supplierId?: string | null;
}

@Injectable()
export class LotService {
  /**
   * Crea un registro Lot para una línea de recepción con número de lote.
   * No-op (devuelve null) si lotNumber está vacío.
   */
  async createLotFromReception(
    tx: Prisma.TransactionClient,
    params: CreateLotParams,
  ) {
    if (!params.lotNumber?.trim()) {
      return null;
    }

    return tx.lot.create({
      data: {
        tenantId: params.tenantId,
        productId: params.productId,
        albaranLineId: params.albaranLineId,
        lotNumber: params.lotNumber.trim(),
        quantity: params.quantity,
        warehouseId: params.warehouseId || null,
        supplierId: params.supplierId || null,
      },
    });
  }
}
```

Nota: `albaranLineId` es `@unique` en el schema (fase 00) — si una línea ya tiene un `Lot` (reintento/idempotencia), `tx.lot.create` fallará con P2002. Igual que el resto del módulo, la idempotencia real la da el check de `stockMovement` existente en `AlbaranStockService.processStockOnConfirmation` (línea 43-49) — este servicio no necesita manejar el caso porque nunca se re-invoca para una línea ya procesada. No añadir manejo de error especulativo (YAGNI).

`albaranes.module.ts`: añadir `LotService` a `providers` (junto a `AlbaranStockService`, `ManualAlbaranService`) y a `exports` si algún módulo futuro (APPCC, recetas) necesitará consultarlo — de momento no exportar fuera del módulo hasta que haya un consumidor real (YAGNI).

## Tests / validación
- Test unitario nuevo `lot.service.spec.ts`: crea Lot con lotNumber válido, devuelve null si lotNumber vacío/null/undefined.
- `npm run build` en `backend/` sin errores de tipos.

## Riesgos y rollback
- Ninguno — código nuevo, sin tocar flujos existentes todavía (eso es fase 02/03). Revertir = borrar el archivo y la línea del módulo.
