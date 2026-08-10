# Plan: click en notificación navega a la entidad + badge de pedidos por revisar

**Status:** DONE (2026-08-10) — las 4 fases implementadas y validadas (tests + agent-browser
contra backend/frontend reales). Ver notas de implementación en cada fichero de fase.
**Origen:** `plans/reports/scout-260726-2111-notificacion-click-navega-articulo-report.md`
(scout original) + consulta `/ask` de 2026-08-10 (no guardada a fichero, resumen abajo).

## Nota de retoma (2026-08-10)

El plan original (2026-07-27) se pospuso a propósito hasta ver más tipos de notificación
en marcha. Ahora hay 4 orígenes reales además de precio (pedido programado generado,
pedido parcial recibido/estancado, desviación de precio pactado, retraso de producción),
así que el usuario decide:
1. Generalizar el diseño a **todos** los tipos de `Alert`, no solo precio (cambio de
   alcance vs. el plan original, que era solo `notifyPriceChange` → producto).
2. Añadir un problema relacionado detectado en la misma sesión: la card "Pedidos
   Pendientes" del dashboard no refleja los pedidos `BORRADOR` generados por
   programación automática (alerta "Pedido programado generado" sin contrapartida
   visual) → badge rojo en la card existente (opción A1, decidida por el usuario sobre
   3 alternativas presentadas).

## Objetivo

1. Al hacer click en cualquier notificación de la campana, navegar a la entidad de
   origen si existe una ruta conocida para su tipo (producto, pedido de compra); si no
   existe ruta o no hay entidad asociada, solo marcar como leída (comportamiento actual,
   sin romper).
2. La card "Pedidos Pendientes" del dashboard muestra un badge rojo con el nº de pedidos
   `BORRADOR` generados por programación automática que aún no se han revisado/enviado.

## Alcance

**Dentro** — inventario completo de los 7 call sites reales de `NotificationsService`
(verificado por grep en backend/src, excluidos specs):

| Origen | Servicio | Tipo de alerta | Entidad natural | Id disponible en scope |
|---|---|---|---|---|
| Cambio manual/OCR de precio | `products.service.ts` (x2), `albaran-stock.service.ts` (x2), `manual-albaran.service.ts` (x2) vía `notifyPriceChange` | `WARNING`/`ERROR` | `PRODUCT` | sí (`existingProduct.id` / `product.id` / `existing.id`) |
| Desviación de precio pactado | `price-agreement.service.ts:157` | `PRICE_AGREEMENT_DEVIATION` | `PRODUCT` | requiere añadir `productId` al `select` de la oferta (línea ~126, hoy solo trae `agreedPrice`/`agreedUntil`) |
| Recepción parcial | `purchase-order-status.service.ts:105` | `PARTIAL_ORDER_RECEIVED` | `PURCHASE_ORDER` | sí (`orderId` en scope) |
| Pedido parcial estancado | `stale-partial-order-alert.service.ts:42` | `STALE_PARTIAL_ORDER` | `PURCHASE_ORDER` | sí (`order.id`) |
| Pedido programado generado | `purchase-schedule.service.ts:219` | `SCHEDULED_ORDER_GENERATED` | `PURCHASE_ORDER` | sí (`order.id`) |
| Retraso de producción | `production.service.ts:878` vía `notifyProductionDelay` | `DELAYED`/`CRITICAL` | `PRODUCTION_ORDER` | sí (`orderId` en scope) — **sin ruta de destino hoy** (ver Fuera) |
| Envíos masivos por rol | `sendBulkNotifications` | variable | ninguna | n/a — queda sin entidad, click solo marca leída |

**Fuera:**
- Deep-link a orden de producción concreta: no existe página de detalle
  (`frontend/src/app/dashboard/production/` solo tiene `page.tsx`, sin ruta `[id]`) — el
  módulo de Producción está en rework activo (`plans/260805-1923-production-module-rework/`).
  El tipo `PRODUCTION_ORDER` se persiste igualmente (dato correcto y reusable a futuro)
  pero el resolver de rutas del frontend no tendrá entrada para él todavía → click en esas
  notificaciones navega a `/dashboard/production` (lista) sin más, o no navega si se
  prefiere no adivinar — decidir en fase 3.
- Alertas APPCC: usan su propio modelo (`ProductionAlert`/APPCC tiene su tabla propia,
  no pasa por `NotificationsService.createNotification`) — no aparecen en la campana hoy,
  fuera de este plan.
- Reestructurar `websocket.service.ts` (`broadcastOrderCreated` etc., líneas 30-182): son
  métodos muertos (solo invocados desde `.spec.ts`, confirmado por grep), no forman parte
  del flujo real de la campana (que pasa 100% por `NotificationsService.createNotification`
  → `broadcastNotification`). No se tocan.
- Arreglar `/orders/:id` como ruta inexistente en esos métodos muertos: bug preexistente
  separado, no se toca aquí.

## Diseño (cambia respecto al plan original)

El plan original guardaba `productId` + una `actionUrl` ya resuelta en backend, específico
de precio. Se generaliza a:
- `Alert.entityType` (string, ej. `PRODUCT`/`PURCHASE_ORDER`/`PRODUCTION_ORDER`) +
  `Alert.entityId` (string) — sin FK (polimórfico, incompatible con relación Prisma
  tipada; mismo precedente que `AlbaranLine.matchedProductId`, ver
  [[papelera-global-trash-module]]).
- La URL **no se guarda en BD ni se calcula en backend**. El frontend resuelve
  `entityType → ruta` con un mapa pequeño y estable (`ENTITY_ROUTES`), para no acoplar
  filas de BD a la estructura de rutas de Next.js (que ya ha cambiado 2 veces, ver
  [[nav-config-restructured-into-category-dropdowns]]).
- Tipos sin entrada en `ENTITY_ROUTES` (o `entityId` nulo) → click solo marca como leída,
  igual que hoy. Nunca lanza error ni navega a `undefined`.

## Fases

1. [Backend: persistir entityType/entityId en Alert](phase-01-backend-persist-entity-reference.md)
   — migración Prisma + `createNotification`/`notifyPriceChange` + 7 call sites +
   `AlertsController`.
2. [Frontend: propagar entityType/entityId por el hook chain](phase-02-frontend-hook-propagation.md)
   — `use-alerts.ts`, `use-websocket.ts`, tipos.
3. [Frontend: navegación genérica desde la campana](phase-03-frontend-navigation-deeplink.md)
   — `ENTITY_ROUTES` resolver, click handler en `layout.tsx`, deep-link en Artículos
   (igual que el plan original), sin deep-link en Pedidos de compra (la página de detalle
   ya existe por id, no requiere query params) ni en Producción (fuera de alcance).
4. [Badge "por revisar" en la card Pedidos Pendientes](phase-04-pedidos-pendientes-badge.md)
   — KPI backend (`purchaseOrder.count` BORRADOR + evento `SCHEDULED_GENERATION`) +
   badge visual en `dashboard/page.tsx` (reusa el estilo del badge de la campana).

## Dependencias

Fase 2 depende de fase 1. Fase 3 depende de fase 2. Fase 4 es independiente de 1-3 (KPI
de dashboard, no toca `Alert`) — puede ejecutarse en paralelo o en cualquier orden.

## Criterios de aceptación

- Provocar una subida de precio, una recepción parcial, un pedido programado generado y
  una desviación de precio pactado → las 4 alertas quedan con `entityType`/`entityId`
  persistidos.
- Click en notificación de precio → navega a
  `/dashboard/articulos?productId=X&tab=historial-precios` y abre el modal en esa pestaña.
- Click en notificación de pedido (parcial/estancado/programado) → navega a
  `/dashboard/compras/pedidos/{orderId}`.
- Click en notificación de producción o en una sin entidad asociada → solo marca como
  leída, sin navegar ni lanzar error.
- Con al menos 1 pedido `BORRADOR` de origen `SCHEDULED_GENERATION` sin enviar, la card
  "Pedidos Pendientes" muestra el badge rojo con el conteo; al enviarlo (deja de ser
  BORRADOR) el badge desaparece o baja el conteo tras refetch (30s, mismo intervalo que
  el resto de KPIs).
- Tests backend existentes (`notifications.service.spec.ts`, `price-agreement.service.spec.ts`,
  `purchase-schedule.service.spec.ts`, `purchase-order-status.service.spec.ts`,
  `stale-partial-order-alert.service.spec.ts`, `dashboard.service.spec.ts` si existe) en
  verde — cambios de firma son aditivos (parámetros opcionales al final).

## Riesgos / rollback

- Migración aditiva (`entityType String?`, `entityId String?`, sin FK) — reversible, no
  destructiva. Alertas ya creadas sin estos campos siguen funcionando (fallback a "sin
  navegación").
- Badge: nuevo campo en la respuesta de `/v1/dashboard/kpis`, aditivo — no rompe
  consumidores existentes del endpoint.
