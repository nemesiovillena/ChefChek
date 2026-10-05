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
