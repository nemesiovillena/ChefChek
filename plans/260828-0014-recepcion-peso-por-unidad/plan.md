# Recepción: conversión ud↔kg con peso por unidad aprendido

**Estado**: en curso · **Rama**: `feat/recepcion-peso-por-unidad` (desde origin/develop 9caf67b) · **Fecha**: 2026-08-28

## Problema

Pedidos en unidades (20 ud berenjena) cuyo albarán llega en kg (7,4 kg): la conciliación
compara números planos → discrepancia falsa y pedido en RECIBIDO_PARCIAL. Afecta a todo
producto de peso variable (verdura, pescado, carne). Causa raíz verificada:

- `order-reconciliation.service.ts:120` solo divide por `unitsPerFormat` (ignora `AlbaranLine.unit`)
- `:164` compara `receivedQuantity >= quantity` sin conversión
- `reception-section.tsx:17-24` exige igualdad exacta si la unidad del pedido no es kg/L

## Solución (aprobada por usuario)

Peso/volumen medio por unidad (`avgUnitWeight`) en el artículo, como puente ud↔kg:

1. **Convertir** al conciliar: cantidad del albarán → unidad de la línea de pedido
   (mismo category usa factores existentes de `UNIT_ALIASES`; cruzado usa `avgUnitWeight`).
2. **Aprender automáticamente** la 1ª vez por ratio de precios:
   `avgUnitWeight = (expectedPrice €/ud) / (unitPrice €/kg)` (con guard de plausibilidad
   0.005–25). Solo se rellena si es null — nunca sobrescribe un valor existente.
3. **Mostrar** en recepción: unidades en columnas + equivalencia "(7,4 kg)" y tolerancia
   ±10% para líneas convertidas entre magnitudes (2% kg/L y exacto ud se mantienen).

## Cambios

| Archivo | Cambio |
|---|---|
| `backend/prisma/schema.prisma` | `Product.avgUnitWeight Float?`; `PurchaseOrderLine.receivedSourceQuantity Float?` + `receivedSourceUnit String?` |
| migración SQL | add-column (flujo `migrate diff` manual, no TTY) |
| `backend/src/common/utils/product-costing.util.ts` | exportar `getUnitMeta()` (category+toBase) reutilizando `UNIT_ALIASES` |
| `backend/src/common/utils/reception-unit-conversion.util.ts` (nuevo) | conversión recibido→unidad de pedido + derivación de peso por precio |
| `backend/src/modules/compras/services/order-reconciliation.service.ts` | acumular por categoría de magnitud, convertir, aprender peso, tolerancia en `allCovered` |
| `frontend/src/hooks/use-purchase-orders.ts` | tipo línea: `receivedSourceQuantity/Unit` |
| `frontend/src/app/dashboard/compras/components/reception-section.tsx` | unidades en celdas, equivalencia, tolerancias nuevas |
| `docs/pdr-modulo-compras.md` §F4 | documentar conversión y aprendizaje |

## Compatibilidad / riesgos

- Sin peso aprendido y sin precios → comportamiento actual (número crudo) — nunca peor que hoy.
- `receivedPrice` pasa a ser €/unidad-de-línea coherente con la cantidad convertida
  (legacy caja mantiene `unitPrice × unitsPerFormat` exacto).
- `avgUnitWeight` NO toca `referenceUnitSize`/`unitSize` → costeo y precios intactos.
- Retro-corrección de pedidos ya marcados PARCIAL: fuera de alcance (solo hacia adelante).

## Aceptación

- Pedido 20 ud + albarán 7,4 kg con peso aprendido 0,37 → RECIBIDO, sin rojo.
- Primer albarán de un producto sin peso → aprende por precios y cuadra en el mismo run.
- Regresión: caja (unitsPerFormat) y kg↔g siguen funcionando (specs).
