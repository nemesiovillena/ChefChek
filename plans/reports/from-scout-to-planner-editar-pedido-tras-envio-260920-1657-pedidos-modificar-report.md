# Scout + Research: modificar pedidos ya creados/enviados (Compras)

Fecha: 2026-09-20 · Fuente: solo repo (sin web; problema 100% de dominio local)

## Causa raíz

Edición bloqueada por diseño en 2 capas, ambas solo permiten `BORRADOR`:

| Capa | Archivo | Regla |
|---|---|---|
| Backend | `backend/src/modules/compras/services/purchase-order.service.ts:199-237` (`update`) | `status !== BORRADOR` → 400 "Solo los pedidos en BORRADOR pueden editarse." |
| Frontend | `frontend/src/app/dashboard/compras/pedidos/[id]/page.tsx:153` (`isDraft`) | inputs cantidad/precio, papelera, buscador artículos, notas, "Guardar cambios" solo si `isDraft` |

Ciclo de vida (`purchase-order-status.service.ts:28-47`): BORRADOR → PENDIENTE_ENVIO → ENVIADO → RECIBIDO_PARCIAL → RECIBIDO; CANCELADO. Al pulsar "Enviar al proveedor" (`order-sending.service.ts:74`) pasa a ENVIADO y ya no hay edición.

## Salida existente (sin código)

`PATCH /compras/pedidos/:id/revertir` (`purchase-order-status.service.ts:124`, botón "Deshacer (volver a Borrador)"):
- Solo ADMIN/OWNER/SUPERADMIN.
- Solo si NO hay albarán vinculado ni `receivedQuantity` en líneas (409 si hay).
- Limpia `sentAt/sentVia/sentBy`, deja evento `ADMIN_REVERT` con motivo (≥10 chars). No pierde datos.
- Después: editar → Guardar → "Enviar al proveedor" otra vez.

**Riesgo del atajo**: reenvía el pedido ENTERO al proveedor (email/WhatsApp) → puede duplicar mercancía si no se avisa.

## Workarounds hoy para los 2 pedidos en producción

1. **Pedido complementario (sin riesgo, sin código)**: crear pedido nuevo al mismo proveedor solo con lo olvidado. Ojo: si el proveedor entrega todo junto, el albarán se vincula a 1 solo pedido (`Albaran.purchaseOrderId`).
2. **Deshacer → editar → reenviar** (si eres ADMIN y no hay albarán): funciona ya, avisar al proveedor de que el 2º envío sustituye al 1º.

## Solución propuesta (recomendada)

"Ampliar pedido" en `ENVIADO` y `RECIBIDO_PARCIAL` (+ edición completa en `PENDIENTE_ENVIO`, que aún no salió).

### Backend
1. `PurchaseOrderService.update`: permitir `BORRADOR | PENDIENTE_ENVIO` como hoy (edición total). Añadir rama para `ENVIADO | RECIBIDO_PARCIAL`:
   - **NO usar `deleteMany + create`** (línea 231): borraría `receivedQuantity/receivedPrice/receivedSource*` de las líneas ya conciliadas → pérdida de datos + rompe conciliación (`order-reconciliation.service.ts:209-219`).
   - Merge por `productId`: líneas nuevas → `create`; existentes → `update` cantidad/unidad/notas; líneas con `receivedQuantity != null` → prohibido borrarlas (400).
   - Recalcular `expectedTotal`; `staleAlertSentAt = null` si RECIBIDO_PARCIAL.
   - Evento `LINES_EDITED` con `payload {added, changed, removed}` (auditoría; los eventos ya existen en `PurchaseOrderEvent`).
2. `RECIBIDO` / `CANCELADO`: siguen cerrados (crear pedido nuevo). Añadir línea a RECIBIDO reabriría estado de conciliación sin máquina de estados definida.
3. Reenvío de solo lo añadido: `OrderSendingService.send` exige BORRADOR/PENDIENTE_ENVIO (`:17-20`). Añadir `sendAmendment(orderId, channel, addedProductIds)` que reutiliza `buildMessage` con cabecera "Ampliación del pedido PED-N" y solo las líneas nuevas; registra evento `SENT` con `payload.amendment=true`; NO cambia status ni `sentAt` original. Email: adjuntar PDF completo o solo ampliación (decidir).

### Frontend
- `pedidos/[id]/page.tsx`: `isEditable = BORRADOR|PENDIENTE_ENVIO`; `canAmend = ENVIADO|RECIBIDO_PARCIAL`. En modo ampliar: inputs de líneas con `receivedQuantity` deshabilitados para borrar; permitir añadir artículos (`ProductSearchInput`), subir cantidad, "Artículos nuevos" y notas.
- Botón "Guardar y avisar al proveedor" → reutiliza `SendOrderDialog` en modo ampliación.
- `EVENT_LABELS` (`:71`): añadir `LINES_EDITED: 'Pedido ampliado'`.
- Hook `use-purchase-orders.ts` (`useUpdatePurchaseOrder`): sin cambios de contrato; invalidar detalle + listado (ya lo hace).

### Tests (jest, no bun test)
- update en ENVIADO: añade línea sin tocar `receivedQuantity` de las otras.
- update en ENVIADO: borrar línea recibida → 400.
- update en RECIBIDO/CANCELADO → 400.
- reconciliación tras ampliar RECIBIDO_PARCIAL: línea nueva sin recibir mantiene PARCIAL.
- sendAmendment: solo líneas nuevas, no cambia status.

### Esfuerzo / riesgo
~1 día. Sin migración Prisma (eventos usan `type: String`, payload JSON). Riesgo medio-bajo: toca `update()` compartido; mantener rama BORRADOR intacta.

## Archivos relevantes

- `backend/src/modules/compras/services/purchase-order.service.ts` — `update()` (bloqueo + deleteMany)
- `backend/src/modules/compras/services/purchase-order-status.service.ts` — máquina de estados + `revertToDraft`
- `backend/src/modules/compras/services/order-sending.service.ts` — `SENDABLE`, `buildMessage`, `send`
- `backend/src/modules/compras/services/order-reconciliation.service.ts` — vuelca recibido a líneas; `allCovered`
- `backend/src/modules/compras/dto/purchase-order.dto.ts` — `UpdatePurchaseOrderDto` (sin cambios necesarios)
- `backend/src/modules/compras/compras.controller.ts:444` — `PATCH pedidos/:id` (docs "solo BORRADOR" a actualizar)
- `frontend/src/app/dashboard/compras/pedidos/[id]/page.tsx` — `isDraft`, footer, `EVENT_LABELS`
- `frontend/src/app/dashboard/compras/components/send-order-dialog.tsx` — reutilizar para ampliación
- `frontend/src/hooks/use-purchase-orders.ts` — mutations
- `backend/prisma/schema.prisma:2264-2335` — `PurchaseOrder`, `PurchaseOrderLine`, `PurchaseOrderEvent`

## Preguntas sin resolver

1. ¿Estado actual de los 2 pedidos (ENVIADO? ¿algún albarán ya vinculado?) y rol del usuario (ADMIN o USER)? Determina si "Deshacer" les vale hoy.
2. ¿Reenviar al proveedor solo la ampliación (recomendado) o el pedido completo actualizado?
3. ¿Permitir también reducir/quitar líneas no recibidas en ENVIADO, o solo añadir/aumentar?
4. ¿Ampliar RECIBIDO (cerrado) o siempre pedido nuevo?
