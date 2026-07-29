# Fase 1: Backend — persistir y exponer productId en Alert

## Contexto

`Alert` (schema.prisma:899-919) no tiene columna para relacionar la alerta con un
producto. `NotificationsService.notifyPriceChange()`
(`backend/src/modules/core/notifications.service.ts:68-84`) recibe `productName` pero no
`productId`, y no lo reenvía a `createNotification`. Ninguno de los 6 call sites lo pasa
hoy, aunque todos tienen el id del producto en scope.

## Archivos a modificar

- `backend/prisma/schema.prisma` (modelo `Alert`)
- migración nueva en `backend/prisma/migrations/`
- `backend/src/modules/core/notifications.service.ts`
- `backend/src/modules/core/alerts.controller.ts`
- `backend/src/modules/products/products.service.ts` (líneas ~756, ~868)
- `backend/src/modules/albaranes/services/albaran-stock.service.ts` (líneas ~160, ~205,
  y el método privado `notifyPriceChange` ~489)
- `backend/src/modules/albaranes/services/manual-albaran.service.ts` (líneas ~109, ~124,
  y el método privado `notifyPriceChange` ~339)
- `backend/src/websocket/types/events.ts` (`NotificationEvent` ya tiene `actionUrl?`, no
  requiere cambio de forma, solo se empieza a rellenar)
- Specs existentes que mockean `notifyPriceChange`/`createNotification` (revisar
  `notifications.service.spec.ts`, `price-agreement.service.spec.ts`,
  `purchase-schedule.service.spec.ts`, `albaran-stock.service.spec.ts` — no deberían
  romperse porque el nuevo parámetro es opcional, pero verificar tras el cambio)

## Pasos

1. **Migración Prisma** — añadir a `Alert`:
   ```prisma
   productId String?
   product   Product? @relation(fields: [productId], references: [id], onDelete: SetNull)
   ```
   Seguir el mismo patrón que `ProductPriceHistory.productId` (schema.prisma:1844,1854)
   pero nullable, ya que otros tipos de alerta (appcc, almacenes, pedidos, producción) no
   tienen producto asociado. Añadir `@@index([productId])`. Ejecutar
   `bunx prisma migrate dev --name alert_add_product_id` (no interactivo en este
   entorno, ver [[catalog-import-background-processing]]).

2. **`notificationsService.notifyPriceChange`** — añadir parámetro `productId?: string`
   al final de la firma (para no romper el orden posicional de los call sites
   existentes salvo añadir el nuevo argumento al final de cada llamada). Pasar
   `productId` a `createNotification` y, si está presente, calcular
   `actionUrl = \`/dashboard/articulos?productId=${productId}&tab=historial-precios\``.

3. **`createNotification`** — aceptar `productId?: string` y `actionUrl?: string` en el
   `data` de entrada; persistir `productId` en `this.prisma.alert.create`; incluir
   `actionUrl` en el payload de `websocketService.broadcastNotification` (el campo ya
   existe en `NotificationEvent`, solo hay que rellenarlo).

4. **6 call sites** — añadir el id del producto ya disponible en scope como último
   argumento de `notifyPriceChange`:
   - `products.service.ts:756` → `existingProduct.id`
   - `products.service.ts:868` → `existingProduct.id`
   - `albaran-stock.service.ts:160,205` → `product.id` (via el método privado
     `notifyPriceChange` de esa clase, que reenvía a
     `notificationsService.notifyPriceChange` en la línea ~496 — propagar el id a
     través del método privado también)
   - `manual-albaran.service.ts:109,124` → `existing.id` (mismo patrón, método privado
     ~339 reenvía a la línea ~345)

5. **`AlertsController.findAll`** — incluir `productId` y `actionUrl` calculado (mismo
   criterio que el paso 2) en el mapeo de respuesta (líneas 36-44), para que las alertas
   ya persistidas (no solo las recién emitidas por WS) también lleven el dato tras un
   reload de página.

## Validación

- `bun run test` en `backend/` — specs de `notifications.service`, `products.service`,
  `albaran-stock.service`, `manual-albaran.service`, `price-agreement.service`,
  `purchase-schedule.service` en verde.
- `curl` manual: provocar una subida de precio >10% (edición manual en Artículos vía
  API) y verificar `GET /api/v1/alerts` devuelve `productId`/`actionUrl` en la fila
  nueva.

## Riesgos

- Los métodos privados `notifyPriceChange` en `albaran-stock.service.ts` y
  `manual-albaran.service.ts` son wrappers finos — si algún test verifica la firma
  exacta con `toHaveBeenCalledWith` y una lista cerrada de argumentos, añadir el nuevo
  argumento puede romperlo. Revisar y actualizar esos asserts si hace falta (no es un
  cambio de contrato público, es interno).
