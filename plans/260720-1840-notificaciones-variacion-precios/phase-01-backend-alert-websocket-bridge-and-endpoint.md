# Phase 01 — Backend: puente Alert→WebSocket + endpoint /alerts + cierre de gap

**Status:** done (2026-07-20)
**Owner files (exclusivos de esta fase):**
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/<nueva>/migration.sql` (generada)
- `backend/src/modules/core/notifications.service.ts`
- `backend/src/modules/core/alerts.controller.ts` (nuevo)
- `backend/src/modules/core/core.module.ts`
- `backend/src/modules/albaranes/services/albaran-stock.service.ts`
- `backend/src/modules/albaranes/services/manual-albaran.service.ts`
- `backend/src/modules/products/products.service.ts`
- specs: `notifications.service.spec.ts` (nuevo si no existe),
  `albaran-stock.service.spec.ts`, `manual-albaran.service.spec.ts`,
  `products.service.spec.ts`

## Contexto verificado (file:line)

- Modelo `Alert`: `backend/prisma/schema.prisma:872-889` — `tenantId, type, alertType,
  severity, message, isResolved, resolvedBy, resolvedAt, createdBy, createdAt,
  updatedAt`. **Sin `title`, sin `isRead`/`readAt`.**
- `isResolved`/`resolvedBy`/`resolvedAt` YA se usan con semántica de negocio distinta en
  `appcc.service.ts`, `production.service.ts`, `dashboard.service.ts`,
  `almacenes.service.ts`, `sala.service.ts`, `ocr/product-recognition.service.ts` — **NO
  reutilizar estos campos para "leído en la campana"**, son conceptos distintos (una
  alerta resuelta por un operario vs. simplemente vista en la campana).
- `NotificationsService.createNotification`:
  `backend/src/modules/core/notifications.service.ts:8-42` — hoy concatena
  `message: data.title ? \`${data.title}: ${data.message}\` : data.message` (línea 32) y
  **descarta `data.userId`** (nunca se escribe, el modelo no tiene esa columna — los
  alerts son tenant-wide, no per-user).
- `NotificationsService.markAsRead`: `:68-84` — stub, no persiste nada (comentario propio
  lo admite: "En una implementación real, tendríamos un campo isRead").
- `NotificationsService.getUserNotifications`: `:44-66` — `where.userId` solo se aplica
  `if (userId)`; el controller nuevo NUNCA debe pasar `userId` (columna inexistente,
  reventaría con `PrismaClientValidationError`).
- `CoreModule`: `backend/src/modules/core/core.module.ts` — `@Global()`, sin
  `controllers:`, sin `imports:`. Se importa una sola vez en `app.module.ts:20/92` junto a
  `WebSocketModule` (líneas hermanas, sin relación circular).
- `WebSocketModule`: `backend/src/websocket/websocket.module.ts` — exporta
  `WebSocketService`, importa `AuthModule` (que NO importa `CoreModule`) → seguro añadir
  `imports: [WebSocketModule]` en `CoreModule` sin `forwardRef`.
- `WebSocketService.broadcastNotification`:
  `backend/src/websocket/websocket.service.ts:189-195` — ya hace
  `gateway.broadcastToTenant(tenantId, "notification", notification)`. Es el único punto
  que realmente llega al evento que escucha el frontend (`websocket-client.ts:319-320`,
  `onNotification` → evento `'notification'`).
- Tipo `NotificationEvent` (backend):
  `backend/src/websocket/types/events.ts:175-183` —
  `{ id, type: 'INFO'|'SUCCESS'|'WARNING'|'ERROR', title, message, data?, actionUrl?,
  createdAt, tenantId }`. Los valores de `severity` ya usados en el código
  ("INFO","WARNING","ERROR") encajan directo en `type`, sin mapeo.
- Duplicación de lógica de "cambio de precio" a extraer:
  - `albaran-stock.service.ts:431-447` (`notifyPriceChange`, privado).
  - `manual-albaran.service.ts:314-329` (`notifyPriceChange`, privado, firma distinta:
    recibe `product` completo en vez de `productName`+`oldPrice`).
- Gap a cerrar: `products.service.ts` — flag `refPriceChanged` calculado en `:546-552`
  (comparación €/kg normalizado, ya correcto post-fix del plan
  `260718-0056-historico-precio-normalizado-kg`), `productPriceHistory.create` en
  `:712-...` dentro del `$transaction`. Falta la llamada a `notifyPriceChange` en esa
  misma rama.
- Patrón de controller/guard a replicar: `products.controller.ts:53-54`
  (`@Controller("api/v1/products")`, `@UseGuards(AuthGuard, TenantGuard, RolesGuard,
  ModuleGuard)`), `req.tenantId` disponible tras `TenantGuard` (`:69,78,...`). El nuevo
  `AlertsController` **NO usa `ModuleGuard`/`@RequireModule`** — la campana es
  transversal, no depende de un módulo activable.
- Interceptor de paginación (memoria `frontend-api-client-paginated-unwrapping`): la
  respuesta del endpoint nuevo debe ser `{success, data, message}` **sin `meta`**, igual
  que el patrón ya validado en `allergens` (memoria `allergens-catalog-global-crud`).

## Pasos

1. **Schema + migración** (`schema.prisma:872`):
   ```prisma
   model Alert {
     id         String    @id @default(cuid())
     tenantId   String
     type       String
     alertType  String
     title      String?   // NUEVO — título separado del mensaje (antes iba concatenado)
     severity   String
     message    String
     isRead     Boolean   @default(false) // NUEVO — leído en la campana (tenant-wide)
     readAt     DateTime? // NUEVO
     isResolved Boolean   @default(false)
     resolvedBy String?
     resolvedAt DateTime?
     createdBy  String
     createdAt  DateTime  @default(now())
     updatedAt  DateTime  @updatedAt

     tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

     @@map("alerts")
   }
   ```
   Generar: `npx prisma migrate dev --name add_alert_title_and_read_state`. Debe ser
   puramente aditiva (`ADD COLUMN ... NULL` / `... DEFAULT false`). Verificar el SQL
   generado antes de aplicar (regla cero pérdida de datos).

2. **`NotificationsService` — separar title/message + persistir isRead + puente WS**:
   - Constructor: inyectar `private readonly websocketService: WebSocketService`.
   - `createNotification`: quitar la concatenación (línea 32); escribir
     `title: data.title ?? null, message: data.message` directo. Tras el
     `prisma.alert.create`, llamar:
     ```ts
     this.websocketService.broadcastNotification({
       id: notification.id,
       type: (data.severity ?? 'INFO') as NotificationEvent['type'],
       title: notification.title ?? data.type,
       message: notification.message,
       createdAt: notification.createdAt,
       tenantId,
     });
     ```
     Import `NotificationEvent` desde `../../websocket/types/events`.
   - `markAsRead(notificationId, tenantId)`: reemplazar el stub por
     `prisma.alert.update({ where: { id: notificationId, tenantId }, data: { isRead: true,
     readAt: new Date() } })` (usar `updateMany` + chequeo de `count` si se quiere evitar
     el `findFirst` previo, o mantener el `findFirst` actual como guarda de existencia y
     encadenar el `update`; cualquiera de los dos es válido, priorizar el que toque menos
     líneas).
   - `getUserNotifications(tenantId, userId, limit)`: **no pasar `userId`** desde el
     controller nuevo (columna inexistente); dejar el método como está (el `if (userId)`
     ya protege). Mapear el resultado a la forma que consume el frontend:
     ```ts
     data: notifications.map(n => ({
       id: n.id,
       type: n.severity,
       title: n.title ?? n.type,
       message: n.message,
       createdAt: n.createdAt,
       tenantId: n.tenantId,
       read: n.isRead,
     }))
     ```
   - **Nuevo método público compartido** `notifyPriceChange`:
     ```ts
     async notifyPriceChange(
       tenantId: string,
       productName: string,
       oldPrice: number,
       newPrice: number,
       percentageChange: number,
     ): Promise<void> {
       const direction = newPrice > oldPrice ? 'aumentado' : 'disminuido';
       const alertType = percentageChange > 25 ? 'ERROR' : 'WARNING';
       await this.createNotification(tenantId, {
         type: alertType,
         title: `Cambio de precio: ${productName}`,
         message: `Precio ${direction} ${Math.abs(percentageChange).toFixed(1)}%. De ${oldPrice.toFixed(2)}€ a ${newPrice.toFixed(2)}€.`,
         severity: alertType,
       });
     }
     ```
     (Mensaje unificado; el de `manual-albaran.service.ts` decía "Cambio de precio
     significativo" — se homogeneiza a un único texto, sin pérdida de información.)

3. **`CoreModule`**: añadir `imports: [WebSocketModule]` y
   `controllers: [AlertsController]`.

4. **`AlertsController`** (`backend/src/modules/core/alerts.controller.ts`, nuevo):
   ```ts
   @Controller('api/v1/alerts')
   @UseGuards(AuthGuard, TenantGuard, RolesGuard)
   export class AlertsController {
     constructor(private readonly notificationsService: NotificationsService) {}

     @Get()
     @Roles('ADMIN', 'USER', 'VIEWER')
     async findAll(@Query('limit') limit: string | undefined, @Req() req: any) {
       return this.notificationsService.getUserNotifications(
         req.tenantId, undefined, limit ? parseInt(limit, 10) : 50,
       );
     }

     @Patch(':id/read')
     @Roles('ADMIN', 'USER', 'VIEWER')
     async markAsRead(@Param('id') id: string, @Req() req: any) {
       return this.notificationsService.markAsRead(id, req.tenantId);
     }
   }
   ```

5. **`albaran-stock.service.ts:431-447`**: reemplazar el cuerpo del método privado
   `notifyPriceChange` por una delegación a
   `this.notificationsService.notifyPriceChange(tenantId, productName, oldPrice, newPrice,
   percentageChange)` (o eliminar el método privado y llamar directo al servicio
   compartido desde el call site — preferible, menos indirección).

6. **`manual-albaran.service.ts:314-329`**: mismo tratamiento; en el call site, extraer
   `productName = product.name`, `oldPrice = product.purchasePrice` antes de invocar
   `notificationsService.notifyPriceChange(...)`.

7. **`products.service.ts` (gap nuevo)**: dentro de la rama `refPriceChanged` (`:546-...`,
   transacción de `update()`), tras el `productPriceHistory.create`, calcular:
   ```ts
   const refBefore = getReferencePrice(existingProduct.purchasePrice, existingProduct.unitSize);
   const refAfter = getReferencePrice(updateData.purchasePrice as number, newUnitSizeForHistory ?? existingProduct.unitSize);
   const pct = refBefore ? Math.abs((refAfter - refBefore) / refBefore) * 100 : 0;
   await this.notificationsService.notifyPriceChange(requestTenantId, existingProduct.name, refBefore, refAfter, pct);
   ```
   Reutilizar `getReferencePrice` ya importado (memoria
   `reference-price-governs-costing`); **no** usar `purchasePrice` crudo (evita reintroducir
   el bug de variaciones falsas por cambio de tamaño de caja, ya arreglado para el
   histórico en `plans/260718-0056-historico-precio-normalizado-kg`). Llamar FUERA de la
   transacción Prisma (tras el `await this.prisma.$transaction(...)`) para no bloquear el
   commit de BD con una llamada de red/WS si algo falla en la notificación.

## Tests

- `notifications.service.spec.ts`: mockear `WebSocketService`; casos —
  `createNotification` separa title/message y llama `broadcastNotification` con el shape
  correcto; `markAsRead` persiste `isRead:true` (assert sobre el `update`/`updateMany`);
  `notifyPriceChange` arma el mensaje/severidad esperados (>25% → ERROR, ≤25% → WARNING).
- `albaran-stock.service.spec.ts` / `manual-albaran.service.spec.ts`: actualizar asserts
  para la delegación al servicio compartido (mismo comportamiento observable, mock
  `notificationsService.notifyPriceChange` en vez de `createNotification` directo si
  aplica).
- `products.service.spec.ts`: nuevo caso — editar `purchasePrice` con €/kg distinto →
  `notificationsService.notifyPriceChange` llamado con precios normalizados; caso "mismo
  €/kg, distinto tamaño de caja" → NO debe notificar (coherente con `refPriceChanged`).
- Correr primero el spec más estrecho, luego ampliar: `npm run test -- <spec>` (o el
  runner que use el `package.json` del backend).

## Riesgos

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|------------|
| Migración destructiva por error de generación | Baja | Alto | Revisar `migration.sql` (solo ADD COLUMN) antes de aplicar; BD dev correcta (memoria dos Postgres) |
| Reutilizar `isResolved` por error para "leído" | — | Alto si ocurre | Evitado por diseño: campos nuevos `isRead`/`readAt` dedicados, no tocar `isResolved` |
| `getUserNotifications` recibe `userId` real y revienta (columna inexistente) | Baja | Medio | Controller nuevo nunca pasa `userId`; documentado en el código con comentario corto |
| Falla el broadcast WS y aborta la creación del alert (regresión del bug ya arreglado con Alert/appcc) | Media | Alto | Envolver `broadcastNotification` en `try/catch` no bloqueante (igual criterio que el fix histórico de `notifications.service.ts` — no debe abortar la transacción de negocio) |
| Doble notificación (WS en vivo + aparece también en el GET al recargar) | Media | Bajo (UX) | Frontend (fase 02) dedupe por `id` al mezclar histórico + eventos en vivo |
| Backend dist stale al probar | Alta | Bajo | `npm run build` + relanzar `start:prod` (memoria backend-dist-mode) |

## Rollback

Revertir cambios de código (git). Las 3 columnas nuevas quedan con default seguro
(`title` null, `isRead` false, `readAt` null) — inertes si el código no las usa. Si se
quiere limpiar el schema, `DROP COLUMN` es seguro (sin FKs sobre ellas).

## Done = observable

- `npx prisma migrate status` limpio; columnas presentes en `alerts`.
- Specs backend tocados en verde.
- Editar el precio de un artículo en Artículos con €/kg realmente distinto → aparece fila
  nueva en `alerts` con `title`/`message` separados y `isRead=false`; con el frontend de
  la fase 02 conectado, la campana lo recibe en vivo.
- `curl -X PATCH .../api/v1/alerts/:id/read` (con auth) → `isRead=true` persistido en BD.

## Resultado (2026-07-20)

Implementado tal cual el plan, con un ajuste importante descubierto durante la
implementación: el gap de "edición manual en Artículos" NO estaba solo en la rama
`refPriceChanged` (transacción directa sobre `Product`, caso legacy sin proveedor) como
decía el paso 7 original — esa rama es la EXCEPCIÓN. El camino real y común (producto con
proveedor preferente) enruta el cambio de precio a través de
`ProductSupplierOffersService.upsertOffer`/`setPreferred` (`products.service.ts:606-686`),
que no tenía ninguna notificación. Se añadió la llamada a `notifyPriceChange` en AMBAS
ramas (la común vía oferta de proveedor y la legacy sin proveedor), no solo en la
documentada originalmente.

Verificación end-to-end contra la BD real (tenant `chefchek-demo`, backend reconstruido y
relanzado): `PATCH /api/v1/products/:id` con `purchasePrice` distinto → nueva fila en
`GET /api/v1/alerts` con título/mensaje separados, €/kg normalizado (1.62€/kg → 2.10€/kg,
+30%, no el precio de caja crudo 8.08€→10.50€) y `read:false`; `PATCH
/api/v1/alerts/:id/read` → `isRead:true` persistido y confirmado en un GET posterior; sin
warnings de fallo de broadcast WS en logs.

Bug de DI encontrado y corregido sobre la marcha: `CoreModule` (`@Global()`) solo
importaba `WebSocketModule`, pero `AlertsController` usa `AuthGuard`/`RolesGuard`, que
necesitan `SessionService` (`AuthModule`) y `UsersService` (`UsersModule`) — Nest no
resuelve imports transitivos de un módulo importado que no los reexporta. Se añadieron
`forwardRef(() => AuthModule)` y `forwardRef(() => UsersModule)` a `CoreModule`, mismo
patrón que `products.module.ts`.

Tests: 1522/1522 backend en verde (incluye specs nuevos/actualizados en
`notifications.service.spec.ts`, `albaran-stock.service.spec.ts`,
`products.service.spec.ts`). `tsc --noEmit` limpio. `manual-albaran.service.spec.ts` no
existe en el repo (documentado como posible en el plan, no había nada que actualizar).
Sin cambios en `docs/` (cambio interno de arquitectura de notificaciones, sin impacto en
workflows documentados de cara al usuario todavía — eso llega con la fase 02).
