# Phase 01 — Backend: migración + snapshot unitSize + trigger normalizado

**Status:** done
**Owner files (exclusivos de esta fase):**
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/<nueva>/migration.sql` (generada)
- `backend/src/common/utils/unit-conversions.ts` (solo lectura/reutilización)
- `backend/src/modules/products/products.service.ts`
- `backend/src/modules/products/product-supplier-offers.service.ts`
- `backend/src/modules/albaranes/services/albaran-stock.service.ts`
- specs: `products.service.spec.ts`, `product-supplier-offers.service.spec.ts`,
  `albaran-stock.service.spec.ts`

## Contexto verificado (file:line)

- Modelo `ProductPriceHistory`: `backend/prisma/schema.prisma:1799-1820` — solo
  `previousPrice`/`newPrice` crudos, sin `unitSize`.
- Util normalización (reutilizar, NO reimplementar):
  `backend/src/common/utils/unit-conversions.ts:70-78`
  `getReferencePrice(purchasePrice, unitSize)` — ya protege `unitSize` 0/null →
  devuelve `purchasePrice` (guardia contra división por cero incluida).
- Endpoint historial: `products.service.ts:1453-1472` `getProductPriceHistory` —
  `findMany` SIN `select` explícito (devuelve fila completa) → los campos nuevos se
  incluyen solos, no hay que tocar el `include`. Verificar tras migración.
- Listado embebido: `products.service.ts:397-401` (include `priceHistory`, fila
  completa, filtrada a `albaranId != null`) y `:419-425` (mapper `latestPriceChange`
  que hoy solo copia `previousPrice`/`newPrice`/`recordedAt`).

## Write-sites (4) — verificados

### 1. `products.service.ts` — edición manual del producto
- Trigger `priceChanged`: `:537-552` (`updateData.purchasePrice !== existingProduct.purchasePrice`).
- Create de la fila: `:689-697`, dentro del `$transaction` de `update()`.
- unitSize en scope:
  - **antes** = `existingProduct.unitSize`.
  - **después** = el `data.unitSize` recalculado si hubo cambio de formato; si NO hubo
    cambio de formato el código hace `delete data.unitSize` (`:531`), así que el
    después = `existingProduct.unitSize`. Capturar el efectivo:
    `const newUnitSize = data.unitSize ?? existingProduct.unitSize`.
- Cambio de trigger: además del actual, comparar €/kg:
  `getReferencePrice(existingProduct.purchasePrice, existingProduct.unitSize)` vs
  `getReferencePrice(nuevoPurchasePrice, newUnitSize)`. Registrar historial cuando el
  €/kg difiera (mantener también el registro cuando cambia el crudo? — ver Nota A).

### 2. `product-supplier-offers.service.ts` — `upsertOffer` (ruta principal)
- unitSize ya calculado en la función: `:73-77`
  (`unitsPerFormat * referenceUnitSize = unitSize`), y `existingOffer.unitSize` es el
  anterior. Datos ya en scope, solo falta usarlos.
- Trigger `priceChanged`: `:82` (`existingOffer.purchasePrice !== data.purchasePrice`).
- Create: `:102-110`.
- **antes** = `existingOffer.unitSize`, **después** = `unitSize` (var local `:77`).
- Cambio de trigger: comparar
  `getReferencePrice(existingOffer.purchasePrice, existingOffer.unitSize)` vs
  `getReferencePrice(data.purchasePrice, unitSize)`.

### 3. `product-supplier-offers.service.ts` — `setPreferred`
- `:150-199`. Trigger: `:177` (`product.purchasePrice !== updated.purchasePrice`).
- Create: `:178-188`.
- **antes** = `product.unitSize`, **después** = `updated.unitSize` (dos ofertas pueden
  tener `unitSize` distinto → justo el caso que hay que normalizar).
- Cambio de trigger: `getReferencePrice(product.purchasePrice, product.unitSize)` vs
  `getReferencePrice(updated.purchasePrice, updated.unitSize)`.

### 4. `albaran-stock.service.ts` — fallback sin proveedor
- `:95-170`. Rama `else` (albarán SIN `supplierId`): create en `:151-160`.
- Esta rama solo actualiza `purchasePrice`/`netPrice`, NO `unitSize` → antes = después
  = `product.unitSize`. Snapshotear igual (ambos = `product.unitSize`) para que el
  frontend calcule normalizado con datos completos.
- Trigger: la comparación de precio de línea está en `:103` (`lineUnitPrice !==
  currentPrice`). Como el `unitSize` no cambia en esta rama, normalizar es equivalente
  a dividir ambos por el mismo `product.unitSize` → el trigger crudo actual sigue
  siendo correcto aquí; NO forzar cambio de comportamiento, solo añadir el snapshot de
  `unitSize` a los dos campos nuevos.
- La rama CON proveedor (`:118-130`) delega en `upsertOffer` (write-site #2) → ya
  cubierta, no es un sitio separado.

## Pasos

1. **Schema + migración** (`schema.prisma:1799`):
   - Añadir a `ProductPriceHistory`:
     ```prisma
     previousUnitSize Float? // Tamaño de unidad (unitSize) del precio anterior; null en filas legacy
     newUnitSize      Float? // Tamaño de unidad del precio nuevo; null en filas legacy
     ```
   - Generar migración: `npx prisma migrate dev --name add_price_history_unit_size`.
     Debe ser puramente aditiva (`ADD COLUMN ... NULL`), sin backfill, sin DROP.
     Verificar el `migration.sql` generado antes de aplicar (regla cero pérdida de datos).

2. **Write-site #2** (`upsertOffer`): añadir `previousUnitSize: existingOffer.unitSize`,
   `newUnitSize: unitSize` al `create` (`:102-110`); cambiar el trigger `:82` a
   comparación normalizada con `getReferencePrice`.

3. **Write-site #3** (`setPreferred`): añadir `previousUnitSize: product.unitSize`,
   `newUnitSize: updated.unitSize` al `create` (`:178-188`); trigger `:177` normalizado.

4. **Write-site #1** (`update`): calcular `newUnitSize = data.unitSize ??
   existingProduct.unitSize`; añadir `previousUnitSize: existingProduct.unitSize`,
   `newUnitSize` al `create` (`:689-697`); trigger `priceChanged` normalizado (Nota A).

5. **Write-site #4** (`albaran-stock` fallback): añadir `previousUnitSize:
   product.unitSize`, `newUnitSize: product.unitSize` al `create` (`:151-160`). Sin
   cambio de trigger.

6. **Listado mapper** (`products.service.ts:419-425`): extender el objeto
   `latestPriceChange` con `previousUnitSize: latest.previousUnitSize`,
   `newUnitSize: latest.newUnitSize` (la fila completa ya los trae tras la migración).

7. **Endpoint** (`getProductPriceHistory:1462`): sin `select` explícito → los campos
   nuevos ya salen. Confirmar en la respuesta. No romper shape existente.

8. **Import de `getReferencePrice`**: los tres servicios deben importar desde
   `backend/src/common/utils/unit-conversions.ts`. Verificar path relativo y que no
   haya colisión con el `getReferencePrice` del frontend (son módulos distintos).

## Nota A — trigger del `update()` manual

Decisión del usuario: el trigger pasa a "¿cambió €/kg normalizado?". Implicación: si el
usuario cambia solo el tamaño de caja manteniendo el precio de caja (mismo crudo,
distinto €/kg) → AHORA sí se registra (correcto). Si cambia el precio de caja pero el
€/kg queda idéntico (raro pero posible) → NO se registra. Implementar el trigger como
`refAnterior !== refNuevo` con `getReferencePrice`. Mantener el seteo de
`data.previousPurchasePrice` (campo plano, flujo aparte) atado a su condición actual
(`:548`) para no alterar ese otro contrato.

## Tests

Actualizar mocks/asserts donde el shape de `productPriceHistory.create` cambie:
- `product-supplier-offers.service.spec.ts`: asserts sobre `create` de #2 y #3 →
  añadir `previousUnitSize`/`newUnitSize` esperados; añadir caso "mismo €/kg distinto
  unitSize → NO crea historial" y "€/kg distinto → SÍ crea".
- `products.service.spec.ts`: asserts del `create` en `update()`; caso normalizado.
- `albaran-stock.service.spec.ts`: assert de que la rama fallback incluye ambos
  `unitSize` = `product.unitSize`.
- Correr primero el spec más estrecho, luego ampliar: `npm run test -- <spec>`.

## Matriz de prueba

| Caso | €/kg antes | €/kg después | ¿crea historial? |
|------|-----------|-------------|------------------|
| Precio caja sube, mismo €/kg (caja más grande) | 12 | 12 | No |
| €/kg realmente sube | 12 | 15 | Sí, +25% |
| €/kg baja | 12 | 9 | Sí, -25% |
| `unitSize` = 0/null (dato corrupto) | fallback crudo | fallback crudo | según crudo |
| Cambio de oferta preferente con distinto unitSize | según ref | según ref | según ref |

## Riesgos

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|------------|
| `unitSize` = 0/null → división por cero | Media | Alto | `getReferencePrice` ya devuelve `purchasePrice` si `!unitSize`; nunca divide por 0 |
| Migración destructiva por error de generación | Baja | Alto | Revisar `migration.sql` (solo ADD COLUMN NULL) antes de aplicar; BD dev correcta (dos Postgres) |
| Cambio de trigger silencia registros que antes se creaban | Media | Medio | Documentado en Nota A; es el comportamiento deseado; cubierto por tests |
| Dos `getReferencePrice` (front/back) divergen | Baja | Medio | Reutilizar el de `unit-conversions.ts`, no copiar fórmula |
| Backend dist stale al probar | Alta | Bajo | `npm run build` + relanzar `start:prod` (memoria backend-dist-mode) |

## Rollback

Revertir los cambios de código (git). La migración deja 2 columnas nullable vacías: son
inertes si el código no las usa → no hace falta migración inversa inmediata; si se
quiere limpiar, `DROP COLUMN` es seguro (siempre null en filas legacy, sin FK).

## Done = observable

- `npx prisma migrate status` limpio; columnas presentes.
- Specs backend en verde.
- Insertar precio con distinto tamaño de caja y mismo €/kg → NO aparece fila nueva en
  `product_price_histories` (verificar por SQL).
