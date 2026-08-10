# Fase 1: Backend — persistir entityType/entityId en Alert

## Contexto

`Alert` (`backend/prisma/schema.prisma:923-943`) no tiene columna para relacionar la
alerta con la entidad de origen. `NotificationsService.createNotification`
(`backend/src/modules/core/notifications.service.ts:15-65`) acepta un `data.metadata`
que nunca se persiste (dead param, se elimina en este cambio ya que se toca la firma de
todos modos). Ninguno de los 7 call sites reales pasa hoy un identificador de entidad,
aunque todos lo tienen en scope (ver tabla de alcance en `plan.md`).

## Archivos a modificar

- `backend/prisma/schema.prisma` (modelo `Alert`)
- migración nueva en `backend/prisma/migrations/`
- `backend/src/modules/core/notifications.service.ts` (`createNotification`,
  `notifyPriceChange`, `notifyProductionDelay`)
- `backend/src/modules/core/alerts.controller.ts` (mapeo de respuesta de `findAll`)
- `backend/src/modules/products/products.service.ts` (líneas ~756, ~868 — llamadas a
  `notifyPriceChange`)
- `backend/src/modules/albaranes/services/albaran-stock.service.ts` (líneas ~160, ~205,
  y el método privado `notifyPriceChange` ~489)
- `backend/src/modules/albaranes/services/manual-albaran.service.ts` (líneas ~109, ~124,
  y el método privado `notifyPriceChange` ~339)
- `backend/src/modules/compras/services/price-agreement.service.ts` (línea ~126, el
  `select` de la oferta; línea ~157, la llamada a `createNotification`)
- `backend/src/modules/compras/services/purchase-order-status.service.ts` (línea ~105)
- `backend/src/modules/compras/services/stale-partial-order-alert.service.ts` (línea ~42)
- `backend/src/modules/compras/services/purchase-schedule.service.ts` (línea ~219)
- `backend/src/modules/production/production.service.ts` (línea ~878 — llamada a
  `notifyProductionDelay`, ya tiene `orderId` en scope en la línea ~870)
- Specs que mockean estos servicios (revisar `notifications.service.spec.ts`,
  `price-agreement.service.spec.ts`, `purchase-schedule.service.spec.ts`,
  `purchase-order-status.service.spec.ts`, `stale-partial-order-alert.service.spec.ts`,
  `production.service.spec.ts`, `albaran-stock.service.spec.ts`,
  `manual-albaran.service.spec.ts` — no deberían romperse porque los nuevos parámetros
  son opcionales, pero verificar tras el cambio)

## Pasos

1. **Migración Prisma** — añadir a `Alert`:
   ```prisma
   entityType String?
   entityId   String?
   ```
   Sin relación FK (polimórfico: `entityType` decide a qué tabla apunta `entityId`,
   Prisma no soporta relaciones polimórficas tipadas). Mismo precedente que
   `AlbaranLine.matchedProductId` (string suelto, sin FK). Añadir
   `@@index([entityType, entityId])` solo si se prevé filtrar por entidad — no
   estrictamente necesario para este alcance (YAGNI), omitir si no hay caso de uso
   inmediato. Ejecutar migración con el workaround no-interactivo habitual
   (`prisma migrate diff` + SQL manual + `migrate deploy`, ver
   [[prisma-migrate-dev-non-interactive-workaround]]).

2. **`createNotification`** (`notifications.service.ts:15-65`) — reemplazar
   `metadata?: any` (dead param) por `entityType?: string; entityId?: string;` en la
   firma de `data`. Persistir ambos en `this.prisma.alert.create`. Incluir
   `entityType`/`entityId` en el payload de `websocketService.broadcastNotification`
   (requiere añadir estos 2 campos opcionales a `NotificationEvent`,
   `backend/src/websocket/types/events.ts:181` — junto al `actionUrl?` ya existente, que
   no se toca por ser de un camino distinto, ver Fuera de alcance en `plan.md`).

3. **`notifyPriceChange`** (`notifications.service.ts:68-84`) — añadir parámetro
   `productId?: string` al final de la firma (no romper el orden posicional existente).
   Pasar `entityType: 'PRODUCT', entityId: productId` a `createNotification` solo si
   `productId` está presente.

4. **`notifyProductionDelay`** (`notifications.service.ts:87-102`) — añadir parámetro
   `orderId?: string` al final. Pasar `entityType: 'PRODUCTION_ORDER', entityId: orderId`
   si está presente.

5. **6 call sites de `notifyPriceChange`** — añadir el id del producto ya disponible en
   scope como último argumento:
   - `products.service.ts:756,868` → `existingProduct.id`
   - `albaran-stock.service.ts:160,205` → `product.id` (vía el método privado
     `notifyPriceChange` de esa clase, que reenvía a
     `notificationsService.notifyPriceChange` en la línea ~496 — propagar el id también
     a través del método privado)
   - `manual-albaran.service.ts:109,124` → `existing.id` (mismo patrón, método privado
     ~339 reenvía a la línea ~345)

6. **`production.service.ts:878`** — añadir `orderId` (ya en scope, línea ~870) como
   último argumento de `notifyProductionDelay`.

7. **`price-agreement.service.ts`** — ampliar el `select` de la oferta (línea ~126) para
   incluir `productId`. Pasar `entityType: 'PRODUCT', entityId: offer.productId` en la
   llamada a `createNotification` (línea ~157).

8. **`purchase-order-status.service.ts:105`, `stale-partial-order-alert.service.ts:42`,
   `purchase-schedule.service.ts:219`** — pasar `entityType: 'PURCHASE_ORDER',
   entityId: order.id` (el id del pedido ya está en scope en los 3 sitios).

9. **`AlertsController.findAll`** — incluir `entityType`/`entityId` en el mapeo de
   respuesta (mismos campos ya vienen del `prisma.alert.findMany`, solo verificar que no
   se están excluyendo con un `select` explícito).

## Validación

- `bun run test` en `backend/` — specs listados arriba en verde.
- `curl` manual: provocar una subida de precio >10% (edición manual en Artículos) y un
  envío/recepción parcial de pedido; verificar `GET /api/v1/alerts` devuelve
  `entityType`/`entityId` en las filas nuevas.

## Riesgos

- Los métodos privados `notifyPriceChange` en `albaran-stock.service.ts` y
  `manual-albaran.service.ts` son wrappers finos — si algún test verifica la firma exacta
  con `toHaveBeenCalledWith` y una lista cerrada de argumentos, añadir el nuevo argumento
  puede romperlo. Revisar y actualizar esos asserts si hace falta (cambio interno, no de
  contrato público).
- Quitar `metadata?: any` de la firma de `createNotification`: verificar por grep que
  ningún call site lo estaba pasando ya (se confirmó vacío en el scout de esta sesión,
  pero re-verificar antes de tocar por si algo cambió).
