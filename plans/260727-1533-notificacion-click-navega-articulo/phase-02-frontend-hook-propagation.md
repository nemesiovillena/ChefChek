# Fase 2: Frontend — propagar productId/actionUrl por el hook chain

## Contexto

`useWebSocketNotifications` (`frontend/src/hooks/use-websocket.ts:49-157`) combina
notificaciones en vivo (`NotificationEvent`, `frontend/src/lib/websocket-client.ts:169`,
ya tiene `actionUrl?: string`) con el histórico persistido (`useAlerts`,
`frontend/src/hooks/use-alerts.ts`, tipo `AlertItem` — sin `actionUrl`/`productId` hoy).
Tras la fase 1 el backend ya manda ambos campos en los dos caminos (WS y
`GET /v1/alerts`); falta que el frontend los tipe y los combine.

## Archivos a modificar

- `frontend/src/hooks/use-alerts.ts` (`AlertItem` interface)
- `frontend/src/hooks/use-websocket.ts` (mapeo de `alerts` → `NotificationEvent` en el
  `useMemo` de `notifications`, líneas 103-122)

## Pasos

1. **`AlertItem`** (`use-alerts.ts:8-15`) — añadir `productId?: string;` y
   `actionUrl?: string;`. El backend ya los incluye en la respuesta de
   `GET /v1/alerts` tras la fase 1 (ver
   [[frontend-api-client-paginated-unwrapping]] para el shape sin `meta`, no cambia).

2. **`use-websocket.ts:103-122`** — en el `map` que convierte `AlertItem` a
   `NotificationEvent` (línea 107-116), añadir `actionUrl: a.actionUrl` al objeto
   mapeado. Las notificaciones en vivo (`wsNotifications`) ya traen `actionUrl` porque
   vienen tal cual del `NotificationEvent` del backend (websocket.service.ts, fase 1) —
   no requieren cambio adicional aquí.

## Validación

- No hay test de frontend específico para estos hooks (verificar con
  `grep -rl "use-websocket\|use-alerts" frontend/src/**/*.spec.* frontend/src/**/*.test.*`
  antes de asumir que no existen). Si no hay suite, validar manualmente en fase 3 junto
  con la navegación (no tiene sentido probar el dato sin el consumidor).

## Riesgos

- Ninguno relevante — cambio aditivo de tipos opcionales, no toca lógica de combinación
  ni el overlay de "leído".
