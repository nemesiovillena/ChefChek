# Scout Report — Notificar variaciones de precio en "Notificaciones"

Objetivo: localizar el pipeline actual de notificaciones y los puntos donde ya se detecta variación de precio, para saber qué falta conectar.

## Hallazgo clave: el pipeline está roto/desconectado

Hay **4 sistemas de "notificación" distintos** que no se hablan entre sí:

1. **Campana "Notificaciones" del dashboard (la que ve el usuario)** — [layout.tsx](frontend/src/app/dashboard/layout.tsx#L190-L218), alimentada por [use-websocket.ts](frontend/src/hooks/use-websocket.ts#L48-L100) (`useWebSocketNotifications`), que solo escucha el evento WebSocket `notification` vía [websocket-client.ts](frontend/src/lib/websocket-client.ts#L319-L320). **No hace fetch a ningún endpoint REST al montar** — si no llega el evento WS, la campana queda vacía.
2. **`NotificationsService` (backend)** — [notifications.service.ts](backend/src/modules/core/notifications.service.ts) escribe en la tabla `Alert` (modelo `Alert`, no `Notification`). **No existe ningún controller que exponga esos alerts** (`find ... *notifications.controller*` no encontró nada) → estas notificaciones quedan huérfanas en BD, nunca llegan al frontend.
3. **`Notification` model + `use-notifications.ts`** — hook frontend en [use-notifications.ts](frontend/src/hooks/use-notifications.ts) llama a `GET/POST/PATCH /v1/notifications`, pero **ese controller tampoco existe** en backend/src. El modelo `Notification` en el schema está ligado a `Task`/`Sprint` (feature de gestión de proyecto, no de negocio).
4. **`WebSocketService.broadcastNotification` / `sendNotificationToUser`** — [websocket.service.ts:189-198](backend/src/websocket/websocket.service.ts#L189-L198), el único método que realmente llega a la campana (emite evento `notification` a la room `tenant:{id}`). **Ningún servicio de negocio lo invoca** — solo se usa internamente para eventos de pedidos (orderCreated/Approved/Rejected).

Conclusión: las notificaciones de cambio de precio que ya existen en el backend (ver abajo) se guardan en la tabla `Alert`, pero nunca llegan a la campana porque falta el puente `NotificationsService` → `WebSocketService.broadcastNotification`.

## Puntos donde YA se detecta variación de precio (backend)

Todos usan `NotificationsService.createNotification` → tabla `Alert` (huérfana, ver arriba):

- [albaran-stock.service.ts:431-447](backend/src/modules/albaranes/services/albaran-stock.service.ts#L431-L447) `notifyPriceChange()` — al confirmar un albarán, compara precio nuevo vs. anterior del producto; severidad WARNING/ERROR según % (>25% = ERROR).
- [manual-albaran.service.ts:325](backend/src/modules/albaranes/services/manual-albaran.service.ts#L325) — mismo patrón en flujo de albarán manual.
- [price-agreement.service.ts:130-163](backend/src/modules/compras/services/price-agreement.service.ts#L130-L163) — desviación de precio pactado con proveedor vs. precio recibido en pedido/albarán (tolerancia configurable vía `getTolerance`), guarda además en tabla `PriceDeviation`.
- [purchase-schedule.service.ts:219](backend/src/modules/compras/services/purchase-schedule.service.ts#L219) — notificación al generar pedido programado (no es variación de precio, es informativo).

## Punto donde NO se notifica variación de precio (gap)

- [products.service.ts:704-720](backend/src/modules/products/products.service.ts#L704-L720) — edición manual de precio en Artículos (ficha de producto): sí registra `productPriceHistory` (traza histórica), pero **no llama a `NotificationsService`** ni emite nada. Cambios de precio hechos a mano en el módulo Artículos son invisibles para el usuario.
- `product-supplier-offers.service.ts` y `supplierPriceHistory` (líneas 1374-1430 de products.service.ts) — histórico de ofertas de proveedor, tampoco dispara notificación.

## Infra de histórico de precios (ya cableada, no es el problema)

- `ProductPriceHistory` / `SupplierPriceHistory` (Prisma) + [use-product-price-history.ts](frontend/src/hooks/use-product-price-history.ts) + [product-price-history-chart.tsx](frontend/src/components/products/product-price-history-chart.tsx) + [product-price-trend-badge.tsx](frontend/src/components/products/product-price-trend-badge.tsx) — esto es visualización histórica en la ficha de producto, funciona bien, es un sistema aparte de "Notificaciones".

## Componentes auxiliares (no relevantes para este flujo)

- [notification-system.tsx](frontend/src/components/notification-system.tsx) — toasts efectivos (`window.addNotification`), 5s auto-dismiss, cliente puro, no persiste ni lee del backend.
- `sprint-tracker/page.tsx` — "Notificaciones" ahí es estado local mock de una feature de gestión de sprints, no relacionado con precios/negocio.

## Qué haría falta para cumplir el pedido

Para que "cualquier variación de precio se notifique en Notificaciones" (la campana real, punto 1):

1. Puente `Alert` → WebSocket: en `NotificationsService.createNotification`, además de escribir en `Alert`, invocar `WebSocketService.broadcastNotification(...)` (o refactorizar para que sea el único responsable), o hacer que cada call site (`notifyPriceChange`, `price-agreement.service`, etc.) llame directamente al gateway.
2. Cerrar el gap de `products.service.ts` (edición manual de precio en Artículos) añadiendo la misma notificación que ya existe en albaranes.
3. Decidir si conviene también persistir para que la campana sobreviva a un refresh de página (hoy `useWebSocketNotifications` solo guarda en estado de React, se pierde al recargar) — implicaría exponer un GET real (falta controller, punto 2/3 del hallazgo).

## Unresolved Questions

- ¿La campana debe sobrevivir a refresh de página (persistencia + endpoint GET) o basta con notificación en vivo mientras la sesión está abierta (solo WS)?
- ¿Umbral de aviso: cualquier variación (0%+) o se mantiene el criterio de "cambio significativo" (hoy ninguno para Artículos, y WARNING/ERROR por % en albaranes)?
- ¿Se debe incluir también variación de precio detectada en `product-supplier-offers` / `supplierPriceHistory` (comparativa de ofertas de proveedor), o solo el precio de compra del producto?
- Los modelos `Alert` (usado hoy) y `Notification` (con `Task`/`Sprint`, sin controller) coexisten sin overlap claro — ¿unificar en uno solo o dejarlos separados por dominio?
