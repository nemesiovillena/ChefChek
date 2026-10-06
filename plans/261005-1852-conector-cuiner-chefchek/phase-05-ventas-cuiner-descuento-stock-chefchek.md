# Fase 5: Ventas de Cuiner → stock de ChefChek

## Requisitos
- Por cada `CuinerSaleLine` nueva, sin anular, con plato mapeado y del tipo que corresponda (P por defecto; I y M según lo que se decida):
  - descomponer la receta (con subrecetas, de forma recursiva) × unidades vendidas;
  - crear una salida de stock (`StockMovement` EXIT) en `CuinerConfig.warehouseId` con el motivo `Venta Cuiner #<idVentasCab>/<linea>`.
- Idempotencia: la clave única `(tenantId, idVentasCab, linea)` hace que reprocesar no duplique.
- Sin mapeo → estado SIN_MAPEO. Al mapear después, se ofrece aplicarlas desde una fecha concreta (opcional).
- Conversión de unidades de la receta a la unidad del stock: reutilizar la lógica de los escandallos. Ojo: `convert-units` no reconoce «kilo».

## Validación
- Tests:
  - plato simple;
  - plato con subreceta;
  - venta anulada (no descuenta);
  - reproceso (no duplica);
  - venta sin mapeo.
- Comprobación manual: comparar el consumo de un día con lo vendido en el TPV.

## ✅ Implementada y probada con datos reales el 06/10/2026
**Decisiones del usuario:**
- Se descuenta en **formatos de compra** (la misma unidad en la que suma el albarán).
- Se aplica con el botón **«Aplicar ventas»**, no de forma automática.

**Backend:**
- `cuiner-recipe-consumption.ts` (puro):
  - descompone la receta y sus sub-recetas (mismas reglas que `calculateSubRecipeCost`, con profundidad máxima 6 contra ciclos);
  - convierte cada ingrediente a formatos con `getUnitToReferenceFactor` ÷ `unitSize`;
  - las unidades negativas (tickets de anulación) devuelven stock.
- `cuiner-stock.service.ts`: `preview` / `apply` / `requeueUnmapped`.
  - Un movimiento por artículo y tanda.
  - Las líneas se reservan con `updateMany` condicionado a PENDIENTE y se comprueba el recuento, para no aplicar nada dos veces.
  - El stock puede quedar negativo.
- Endpoints: `GET sales/preview`, `POST sales/apply`, `POST sales/requeue-unmapped`.

**Cambio respecto al plan:** sin almacén configurado, las ventas descuentan del **stock general (`warehouseId` null)**.
- El tenant demo (copia de producción) no tiene almacenes: sus 220 registros de stock están sin almacén, porque los albaranes se confirman sin almacén.
- Exigir un almacén habría creado un stock paralelo.

**Aviso de datos:** la previsualización avisa si un artículo a descontar se compra en «Caja 24 u» / «Saco 25 kg»… pero tiene `unitSize = 1`. Hay 16 artículos así en la demo (p. ej. «COCACOLA ZER VR35 C24.», «QUESO MASCARPONE 6X500G.»). Ese dato ya distorsiona hoy el precio de referencia y el escandallo.

**Frontend:** pestaña «Ventas» en `/dashboard/cuiner`:
- lo que se descontará;
- lo vendido sin enlazar;
- avisos;
- botones «Aplicar ventas» (con confirmación) y «Reintentar las sin enlazar».

**Prueba real** (337 líneas subidas por el conector):
- Plato «COCA COLA 350 CL» (13 vendidas) enlazado a «COCACOLA VR35 C24» (caja de 24).
- Previsualización: −0,5417. Aplicado: stock 2 → 1,4583, con un movimiento EXIT «Ventas Cuiner del 2026-10-04».
- Segunda pulsación: 0 cambios.
- Después se restauró exactamente la base de desarrollo (movimiento borrado, stock en 2, líneas de nuevo en PENDIENTE, enlace y usuario temporal borrados).

**Verificación:** 59 tests del módulo; suite completa del backend: 146 suites y 2128 tests; `tsc` y `eslint` del frontend limpios.
