# Sprint 3 — Recepción: conciliación pedido↔albarán y factura mínima

**Fecha**: 2026-07-15 · **Rama**: develop · **BD**: localhost:5432/chefchek

## Resultado: ✅ COMPLETADO (1 limitación documentada, sin bloqueo)

## Checking ejecutado (curl end-to-end contra :3001 real + Jest)

| Criterio | Resultado | Evidencia |
|---|---|---|
| Regresión: albarán SIN pedido, flujo intacto | ✅ | Crear→match→confirmar línea→REVISADO→CONFIRMADO, todo 200/201; `purchaseOrder: null` en el resultado |
| Vincular a pedido ENVIADO + confirmar → conciliación | ✅ | Pedido 10 uds → albarán 4 uds (precio 12,50) → pedido `RECIBIDO_PARCIAL`, `receivedQuantity=4`, `receivedTotal=50` |
| Recepción parcial → segundo albarán completa → RECIBIDO | ✅ | 2º albarán +6 uds (precio 12) → pedido `RECIBIDO`, `receivedQuantity=10`; ambos albaranes listados en `albaranes: [REC-1, REC-2]` |
| Discrepancias visibles | ✅ | Línea del pedido expone `quantity` vs `receivedQuantity` y `expectedPrice` vs `receivedPrice`; UI resalta en rojo cuando difieren (`ReceptionSection`) |
| Sugerencia de pedidos filtra por proveedor y ventana | ✅ | `pendientes-recepcion?supplierId=` devolvió el pedido recién enviado; tras pasar a RECIBIDO, desapareció de la lista (filtro `status IN [ENVIADO, RECIBIDO_PARCIAL]`) |
| Factura mínima | ✅ | Creada sin indicar proveedor (resuelto del pedido: "Doria foods"); listada por `purchaseOrderId`; sin proveedor ni vínculo → 400; borrado (soft) verificado en BD |
| Borrado de albaranes respeta la regla | ✅ | CONFIRMADO → 400 (regresión); PENDIENTE → 200 |
| Specs | ✅ | 12 tests nuevos (order-reconciliation 6, invoice 4) + spec de `albaran-status` actualizado; 59 tests módulos compras+albaranes-status pasan. Las 2 suites con 18 fallos preexistentes (`albaranes.controller.spec.ts`, `albaran-stock.service.spec.ts`) se verificaron idénticas en `develop` sin mis cambios (stash) — no son regresión |
| Builds | ✅ | `nest build`, `tsc --noEmit`, `next build` limpios (rutas `/dashboard/albaranes/[id]/resumen` y `/dashboard/compras/pedidos/[id]` compilan) |

## Cambios realizados

- **Schema/migración** `add_purchase_order_reception` (aditiva, probada sobre copia con inversa: 20 albaranes/1 invoice intactos tras rollback): `Albaran.purchaseOrderId?`, `Invoice.albaranId?/purchaseOrderId?/fileUrl?/deletedAt?` + relaciones inversas en `PurchaseOrder`; `invoice` añadido al allowlist de soft-delete.
- **Backend**: `order-reconciliation.service.ts` (nuevo, en `compras/`) — `suggestOrders` (ventana ±7 días) y `reconcileFromAlbaran` (acumula `receivedQuantity` por producto entre albaranes, último precio recibido manda, recalcula `receivedTotal`, transiciona el pedido reutilizando `PurchaseOrderStatusService`). `invoice.service.ts` (registro mínimo, resuelve proveedor desde pedido/albarán si no se indica). Hook en `albaran-status.service.ts`: tras `processStockOnConfirmation`, invoca `reconcileFromAlbaran` (no-op si no hay `purchaseOrderId` — sin `forwardRef`, `AlbaranesModule` importa `ComprasModule` sin ciclo). Endpoints: `GET /compras/pedidos/pendientes-recepcion`, `GET/POST/DELETE /compras/facturas*`. `PurchaseOrderService.findOne` ahora incluye `albaranes` e `invoices`. DTOs de albaranes (`create`/`update`) aceptan `purchaseOrderId` (null desvincula).
- **Frontend**: `PurchaseOrderPickerDialog` (sugiere pedidos del proveedor del albarán, patrón `SupplierPickerDialog`) montado en `dashboard/albaranes/[id]/resumen`; `ReceptionSection` (discrepancias + albaranes vinculados) e `InvoicesSection` (alta/listado/borrado) en el detalle del pedido; hooks `use-pending-reception-orders.ts` y `use-purchase-invoices.ts`.

## Decisión anotada (limitación documentada)

- **`receivedPrice` es "último precio recibido", no un promedio ponderado**: si dos entregas parciales del mismo producto llegan a precios distintos (12,50 y 12 en la prueba), `receivedTotal` se calcula como `receivedQuantity × último receivedPrice` (120), no como la suma real de lo pagado en cada entrega (122). Es una simplificación consciente (YAGNI): registrar el histórico de precio por entrega requeriría una sub-tabla de recepciones, fuera de alcance de este sprint. El histórico de precio real por producto sigue completo e inalterado en `ProductPriceHistory` (vía `albaran-stock.service`), así que no hay pérdida de trazabilidad — solo el agregado `receivedTotal` del pedido es aproximado en este caso límite. Documentar si se retoma en un sprint futuro de analítica/pactados.

## Observaciones / pendiente

1. Verificación visual del selector de pedido y las secciones de recepción/facturas en la UI (build OK, API verificada por curl).
2. Datos de prueba del checking limpiados (albaranes REG-1/REC-1/REC-2, pedido PED-0005, factura F-TEST-1, stock del Medallón restaurado a 2).
3. El escenario "línea confirmada sin contrapartida en el pedido" (producto no pedido originalmente) está cubierto solo por test unitario (mock), no por curl end-to-end — comportamiento: no-op, no rompe nada.
