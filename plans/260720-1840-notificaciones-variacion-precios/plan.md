---
title: "Notificar variaciones de precio en la campana de Notificaciones"
description: "Cerrar el pipeline roto entre las alertas de cambio de precio (backend, tabla Alert huérfana) y la campana real del dashboard (WebSocket-only, sin persistencia); cerrar el gap de la edición manual de precio en Artículos"
status: done
completed: 2026-07-20
priority: P2
effort: 6h
branch: develop
tags: [backend, frontend, prisma, notifications, websocket, products, price-history]
created: 2026-07-20
---

## Problema (ver informe previo)

`plans/reports/scout-260720-1800-notificaciones-variacion-precios-report.md`. Resumen:
la campana "Notificaciones" del dashboard (`useWebSocketNotifications`) solo escucha el
evento WebSocket `notification` — no persiste ni hace fetch al montar. Las alertas de
cambio de precio que ya existen en backend (`NotificationsService.createNotification`)
escriben en la tabla `Alert`, pero ningún controller la expone y ningún servicio de
negocio llama a `WebSocketService.broadcastNotification` — quedan huérfanas, la campana
nunca las ve. Además, la edición manual de precio en Artículos no notifica nada (solo dos
sitios ya notifican: confirmación de albarán y desviación de precio pactado).

## Decisiones (usuario, 2026-07-20)

1. **Persistencia**: sí — nuevo endpoint GET para hidratar la campana al cargar/recargar,
   más persistencia real de "leído" (hoy `markAsRead` es un stub que no persiste nada).
2. **Alcance de fuentes**: albaranes (ya wireado) + precio pactado (ya wireado) + edición
   manual de precio en Artículos (gap a cerrar). **Fuera de alcance**: ofertas de
   proveedor (`product-supplier-offers`/`supplierPriceHistory`).
3. **Modelo de datos**: mantener `Alert` y `Notification` separados (YAGNI). `Alert` sigue
   siendo el modelo de alertas de negocio tenant-wide; solo se conecta
   `Alert → WebSocket → campana`. No se toca `Notification` (dominio Task/Sprint).

## Fases

| # | Fase | Estado | Depende de | Owner (archivos) |
|---|------|--------|-----------|------------------|
| 01 | [Backend: schema + puente WS + notifyPriceChange compartido + endpoint /alerts + cierre de gap en Artículos](phase-01-backend-alert-websocket-bridge-and-endpoint.md) | done | — | `backend/prisma/schema.prisma`, `backend/src/modules/core/*`, `backend/src/modules/albaranes/services/{albaran-stock,manual-albaran}.service.ts`, `backend/src/modules/products/products.service.ts` |
| 02 | [Frontend: hook de alertas persistidas + wire en la campana del dashboard](phase-02-frontend-alerts-hook-and-bell-wiring.md) | done | 01 (contrato del endpoint) | `frontend/src/hooks/use-alerts.ts` (nuevo), `frontend/src/hooks/use-websocket.ts`, `frontend/src/app/dashboard/layout.tsx` |

Fases secuenciales por dependencia de contrato: el frontend (02) consume el shape del
endpoint que expone el backend (01). Sin solapamiento de archivos entre fases.

## Grafo de datos

```
notifyPriceChange (compartido en NotificationsService)
  ├─ albaran-stock.service.ts    (confirmación de albarán, ya existía)
  ├─ manual-albaran.service.ts   (albarán manual, ya existía)
  └─ products.service.ts         (edición manual en Artículos, NUEVO)
        │
        ▼
  NotificationsService.createNotification
        │
        ├─→ prisma.alert.create({ title, message, isRead:false, ... })   [persistencia]
        └─→ websocketService.broadcastNotification(...)                  [tiempo real]
                                                                              │
        GET /api/v1/alerts (hidratación al cargar)  ─────────────────────────┤
        PATCH /api/v1/alerts/:id/read (persistir leído)                     │
                                                                              ▼
                                                          useWebSocketNotifications
                                                          (frontend/src/hooks/use-websocket.ts)
                                                                              │
                                                                              ▼
                                                    campana "Notificaciones" (layout.tsx)
```

## Criterios de aceptación

1. Migración Prisma aditiva en `Alert`: `title String?`, `isRead Boolean @default(false)`,
   `readAt DateTime?`. Sin tocar filas existentes, sin reset de BD.
2. `NotificationsService.createNotification` ya no concatena `title` dentro de `message`;
   guarda ambos campos por separado y además emite el evento WS `notification` a la room
   del tenant.
3. `NotificationsService.markAsRead` persiste de verdad (`isRead:true, readAt:now`), no un
   stub que no escribe nada.
4. Lógica de "cambio de precio" (mensaje, dirección, severidad por %) vive en un único
   método compartido `NotificationsService.notifyPriceChange(...)`; los 3 call sites
   (albaranes, albarán manual, edición manual de Artículos) lo reutilizan — sin
   duplicación de la fórmula de mensaje/severidad.
5. Edición manual de precio en Artículos (`products.service.ts`, rama `refPriceChanged`)
   dispara `notifyPriceChange` usando precio normalizado €/kg (mismo criterio que el
   histórico ya arreglado en `plans/260718-0056-historico-precio-normalizado-kg`), no
   precio crudo — para no reintroducir variaciones falsas en el mensaje de notificación.
6. `GET /api/v1/alerts?limit=` devuelve `{success, data, message}` SIN `meta` (para no
   activar el desempaquetado paginado del interceptor global — memoria
   `frontend-api-client-paginated-unwrapping`), con filas mapeadas a
   `{id, type, title, message, createdAt, tenantId, read}`.
7. La campana del dashboard hidrata su lista al montar (GET) y sigue recibiendo eventos en
   vivo por WebSocket sin duplicados; "Marcar todas como leídas" y click individual
   persisten en backend (no solo estado local de React).
8. Sin regresión: `notifications.service.spec.ts`, `albaran-stock.service.spec.ts`,
   `products.service.spec.ts`, build limpio (`tsc --noEmit`) frontend y backend.

## Fuera de alcance (NO tocar)

- `product-supplier-offers.service.ts` / `supplierPriceHistory` — decisión explícita de
  no incluir variaciones de oferta de proveedor en esta ronda.
- Unificación de los modelos `Alert` y `Notification` — decisión explícita de dejarlos
  separados.
- `sprint-tracker/page.tsx` (Notificaciones ahí es un mock local de otra feature) y
  `notification-system.tsx` (toasts efímeros, sistema aparte).
- Endpoint bulk `PATCH /alerts/read-all` — "marcar todas" se resuelve en frontend
  disparando N mutaciones individuales sobre la lista visible (dataset pequeño, `limit`
  50, se muestran 5).

## Verificación (recordatorio de entorno)

Backend corre desde `dist`, no watch (memoria `backend-dist-mode-not-watch`): tras tocar
backend, `npm run build` + relanzar `start:prod` antes de probar en la UI. Migración:
`npx prisma migrate dev` en la BD que usa el `:3001` activo (memoria
`two-postgres-databases-dev`, hay dos Postgres en dev). El proyecto usa `bun`, no `npm`,
para instalar/ejecutar scripts (memoria `project-uses-bun-not-npm`) salvo que el
`package.json` del backend indique lo contrario para este comando puntual — usar el mismo
gestor que ya usan los scripts existentes del repo.
