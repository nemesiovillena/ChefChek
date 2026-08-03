# Plan: revertir estado de pedido de compra a Borrador

## Status
No iniciado.

## Contexto

El 2026-08-03 el pedido PED-0007 (prod) fue marcado por error `ENVIADO`/`RECIBIDO` dos veces vía los botones de un-clic sin confirmar de la ficha de pedido. La máquina de estados de `backend/src/modules/compras/services/purchase-order-status.service.ts` (`VALID_TRANSITIONS`) solo permite volver a `BORRADOR` desde `PENDIENTE_ENVIO`. Desde `ENVIADO`, `RECIBIDO_PARCIAL`, `RECIBIDO` o `CANCELADO` no hay transición de vuelta, ni endpoint, ni botón — la única vía fue un UPDATE manual directo en la BD de producción (abriendo puerto temporal en Dokploy), dos veces en el mismo día.

Investigando por qué el usuario acabó marcando "enviado" sin enviar de verdad, se encontró la causa raíz de fondo: el proveedor de ese pedido ("Mar Menor") tiene WhatsApp guardado pero no marcado como método de pedido (`orderMethods: ["WEB"]`), así que el diálogo de envío solo ofrecía "Marcar enviado" (canal WEB, sin envío real) — ver fase 3.

Objetivo: (1) dar una vía segura en la propia app para revertir un pedido mal marcado a `BORRADOR` sin depender de SQL manual, y (2) evitar que un proveedor quede mal configurado (dato de contacto guardado pero canal no marcado) sin que nadie lo note.

## Fases

1. [phase-01-backend-revert-endpoint.md](phase-01-backend-revert-endpoint.md) — método de servicio + endpoint + guardas + auditoría
2. [phase-02-frontend-revert-ui.md](phase-02-frontend-revert-ui.md) — botón condicionado por rol + diálogo con motivo obligatorio + hook
3. [phase-03-supplier-form-order-method-mismatch-warning.md](phase-03-supplier-form-order-method-mismatch-warning.md) — aviso en ficha de proveedor si hay contacto guardado sin marcar como método de pedido

## Dependencias
Fase 2 depende de fase 1 (endpoint debe existir antes de conectarlo). Fase 3 es independiente, puede hacerse en cualquier orden.

## Criterios de aceptación
- Un ADMIN (o rol superior) puede revertir un pedido en `ENVIADO`, `RECIBIDO_PARCIAL`, `RECIBIDO` o `CANCELADO` de vuelta a `BORRADOR` desde la ficha del pedido, sin tocar la BD a mano.
- Un USER/VIEWER no ve el botón ni puede llamar al endpoint (403).
- Si el pedido tiene algún albarán vinculado o alguna línea con `receivedQuantity` registrada, la reversión se bloquea con mensaje claro (409) — evita perder datos de recepción real.
- Cada reversión exige un motivo (texto, mínimo 10 caracteres) y queda registrada en `purchase_order_events` (`STATUS_CHANGED`, canal `ADMIN_REVERT`, payload con `reason`).
- Al revertir, se limpian `sentAt`/`sentVia`/`sentBy` (vuelve a estado limpio de borrador).
- Tests backend cubren: transición válida, bloqueo por albarán/recepción vinculada, bloqueo por rol insuficiente, motivo faltante/corto.
