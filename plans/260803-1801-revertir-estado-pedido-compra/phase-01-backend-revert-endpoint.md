# Fase 1: endpoint backend para revertir estado a Borrador

## Contexto
- Máquina de estados: `backend/src/modules/compras/services/purchase-order-status.service.ts:14-33` (`VALID_TRANSITIONS`), método `transition()` líneas 39-81.
- Endpoint existente de transición: `backend/src/modules/compras/compras.controller.ts:323-339` (`PATCH pedidos/:id/estado`, `@Roles("ADMIN", "USER")`).
- Ya hay precedente de endpoint restringido solo a `@Roles("ADMIN")` en el mismo controller (líneas 117, 134, 142).
- Guard activo: `backend/src/guards/roles.guard.ts` + `backend/src/modules/users/users.service.ts:339-348` (jerarquía `SUPERADMIN(5) > OWNER(4) > ADMIN(3) > USER(2) > VIEWER(1)`) — `@Roles("ADMIN")` deja pasar ADMIN/OWNER/SUPERADMIN, bloquea USER/VIEWER.
- Conciliación real de recepción: `backend/src/modules/compras/services/order-reconciliation.service.ts:59-172` (`reconcileFromAlbaran`) — escribe `receivedQuantity`/`receivedPrice` en `PurchaseOrderLine` y vincula `albaranes.purchaseOrderId`.
- Eventos de auditoría: tabla `purchase_order_events` (`type`, `channel`, `userId`, `payload` jsonb).

## Requisitos
1. Nuevo método `revertToDraft(tenantId, orderId, userId, reason)` en `PurchaseOrderStatusService`.
2. Nuevo endpoint `PATCH pedidos/:id/revertir` en `compras.controller.ts`, `@Roles("ADMIN")` (excluye USER/VIEWER).
3. Nuevo DTO `RevertPurchaseOrderDto { reason: string }` con `@IsString() @MinLength(10)` (class-validator, mismo patrón que otros DTOs del módulo).

## Lógica de `revertToDraft`
1. Buscar el pedido (`findFirst` con `tenantId` + `id`), 404 si no existe.
2. Guardar contra estado actual: solo permitido si `status` es `ENVIADO`, `RECIBIDO_PARCIAL`, `RECIBIDO` o `CANCELADO` (si ya está en `BORRADOR`/`PENDIENTE_ENVIO` no aplica — usar la transición normal existente). 400 si no aplica.
3. Guarda anti-pérdida de datos (bloqueo, no solo warning):
   - `count(albaranes where purchaseOrderId = orderId) === 0`
   - Ninguna `PurchaseOrderLine` del pedido tiene `receivedQuantity != null`
   - Si cualquiera falla → `ConflictException` (409) con mensaje explícito: "No se puede revertir: el pedido tiene recepción o albarán vinculado. Requiere corrección manual."
4. Transacción (`$transaction`):
   - `purchaseOrder.update`: `status: 'BORRADOR'`, `sentAt: null`, `sentVia: null`, `sentBy: null`.
   - `purchaseOrderEvent.create`: `type: 'STATUS_CHANGED'`, `channel: 'ADMIN_REVERT'`, `userId`, `payload: { from: order.status, to: 'BORRADOR', reason }`.
5. Devolver el pedido actualizado (mismo shape que `transition()`).

## Archivos a modificar
- `backend/src/modules/compras/services/purchase-order-status.service.ts` — añadir `revertToDraft`.
- `backend/src/modules/compras/compras.controller.ts` — nuevo endpoint (junto al de `/estado`).
- `backend/src/modules/compras/dto/` — nuevo `revert-purchase-order.dto.ts` (seguir convención de los DTOs vecinos, ej. `transition-purchase-order.dto.ts`).

## Tests
Ubicar/crear spec junto a los existentes del módulo (buscar `*.spec.ts` en `backend/src/modules/compras/services/`). Casos:
- Revertir desde `RECIBIDO` sin albarán/recepción → éxito, evento creado, `sentAt` limpio.
- Revertir desde `ENVIADO` → éxito.
- Bloqueo si hay albarán vinculado (`ConflictException`).
- Bloqueo si alguna línea tiene `receivedQuantity` seteado (`ConflictException`).
- Bloqueo si estado actual es `BORRADOR`/`PENDIENTE_ENVIO` (`BadRequestException`, no aplica).
- `reason` faltante o < 10 chars → 400 (validación DTO).
- Rol `USER`/`VIEWER` → 403 (test de guard/e2e si el módulo ya tiene ese patrón, si no, solo documentar como verificación manual).

Ejecutar con `bun run test` (no `bun test`, ver nota del repo sobre jest vs bun test) acotado al módulo compras primero.

## Riesgos / rollback
- Riesgo: si la guarda de "sin albarán/recepción" tiene un bug, podría permitir revertir un pedido con datos reales de recepción → usar exactamente las mismas comprobaciones que se hicieron manualmente en el incidente (count albaranes, receivedQuantity null) y cubrirlas con test antes de mergear.
- Rollback: feature aislada (nuevo método + endpoint), revertir el commit basta; no toca datos existentes ni migra schema.
