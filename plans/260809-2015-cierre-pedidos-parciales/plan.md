# Cierre de pedidos "Recibido parcial" + alerta de estancados

Status: completado (verificado en navegador + backend build/tests en verde)
Branch: main

## Contexto
Pedidos de compra en `RECIBIDO_PARCIAL` cuyo proveedor nunca envía el resto se quedan
atascados sin salida (la única transición válida hoy es `RECIBIDO_PARCIAL → RECIBIDO`,
y su label dice "recepción completa sin discrepancias"). Decisiones del usuario:
- Cualquier usuario puede cerrar el pedido (sin restricción de rol).
- Debe quedar registrado quién lo cerró (ya lo graba `transition()` vía `userId` del evento).
- Se necesita alerta cuando un pedido lleva días en `RECIBIDO_PARCIAL` sin novedad.

Ver consulta previa en la conversación (`/ask`) para el análisis completo.

## Decisiones de diseño
- Sin campo/estado nuevo en el enum `PurchaseOrderStatus` (evita romper `VALID_TRANSITIONS`,
  `STATUS_ACTIONS`, `ORDER_STATUS_META` y 6+ archivos que filtran por estos estados).
- El cierre reutiliza la transición existente `RECIBIDO_PARCIAL → RECIBIDO`, con un
  `reason` opcional que se guarda en el payload del evento (mismo patrón que `revertToDraft`).
- Badge "Cerrado con falta" en el detalle: comparación `receivedTotal < expectedTotal` en
  estado `RECIBIDO` — dato ya existente, sin campo nuevo.
- Dedup de la alerta: campo nuevo `staleAlertSentAt` en `PurchaseOrder` (única migración).
  Se resetea a `null` cuando llega nueva recepción (reconciliación con albarán), así un
  pedido que vuelve a tener actividad puede re-alertar si se estanca otra vez.
- Umbral: 3 días sin actividad (`updatedAt` del pedido) en `RECIBIDO_PARCIAL`. Constante
  nombrada, fácil de ajustar.
- Alerta vía infraestructura existente: `NotificationsService.createNotification` (modelo
  `Alert`, alimenta la campana/WS) + `@Cron` en el propio módulo de compras, mismo patrón
  que `PurchaseScheduleService.runTick`.

## Fases
1. Schema: `staleAlertSentAt DateTime?` en `PurchaseOrder` + migración.
2. Backend: `reason` opcional en `TransitionPurchaseOrderDto`, incluido en el payload del evento.
3. Backend: reset de `staleAlertSentAt` en `order-reconciliation.service.ts` al registrar nueva recepción.
4. Backend: `StalePartialOrderAlertService` (cron diario) — detecta pedidos `RECIBIDO_PARCIAL`
   estancados ≥3 días, notifica y marca `staleAlertSentAt`.
5. Frontend: dialog de cierre con motivo opcional al pasar `RECIBIDO_PARCIAL → RECIBIDO`,
   badge "Cerrado con falta" en el detalle.
6. Verificación: build + jest backend, smoke test en navegador.

## Ampliación post-implementación
- Redirige al listado de Compras tras cerrar un pedido parcial (antes se quedaba en el detalle).
- Notificación inmediata en la campana en cuanto un pedido entra en `RECIBIDO_PARCIAL`
  (`PurchaseOrderStatusService.transition`, no solo la alerta de 3 días de estancado).
  Verificado con transición real vía API sobre un pedido de prueba (PED-0003): la fila en
  `alerts` se creó y apareció en la campana del frontend.

## Criterios de aceptación
- Cerrar un pedido `RECIBIDO_PARCIAL` desde cualquier usuario funciona y queda el evento
  con `userId` + `reason` (si se escribió).
- El pedido cerrado con `receivedTotal < expectedTotal` muestra el badge de discrepancia.
- Un pedido `RECIBIDO_PARCIAL` sin actividad 3+ días genera una notificación una sola vez
  (no se repite hasta que vuelva a haber actividad).
- Tests backend existentes de `purchase-order-status`, `order-reconciliation` siguen en verde.
