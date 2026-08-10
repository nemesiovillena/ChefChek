# Fase 2: Frontend — propagar entityType/entityId por el hook chain

## Contexto

`useWebSocketNotifications` (`frontend/src/hooks/use-websocket.ts:49-157`) combina
notificaciones en vivo (`NotificationEvent`, `frontend/src/lib/websocket-client.ts:169`)
con el histórico persistido (`useAlerts`, `frontend/src/hooks/use-alerts.ts`, tipo
`AlertItem` — sin `entityType`/`entityId` hoy). Tras la fase 1 el backend ya manda ambos
campos en los dos caminos (WS y `GET /v1/alerts`); falta que el frontend los tipe y los
combine.

## Archivos a modificar

- `frontend/src/hooks/use-alerts.ts` (`AlertItem` interface)
- `frontend/src/hooks/use-websocket.ts` (mapeo de `alerts` → `NotificationEvent` en el
  `useMemo` de `notifications`, líneas ~103-122)
- `frontend/src/lib/websocket-client.ts` (`NotificationEvent` interface, línea ~169 —
  añadir `entityType?`/`entityId?` junto al `actionUrl?` ya existente)

## Pasos

1. **`AlertItem`** (`use-alerts.ts`) — añadir `entityType?: string; entityId?: string;`.
   El backend ya los incluye en la respuesta de `GET /v1/alerts` tras la fase 1 (ver
   [[frontend-api-client-paginated-unwrapping]] para el shape sin `meta`, no cambia).

2. **`NotificationEvent`** (`websocket-client.ts:169`) — añadir los mismos dos campos
   opcionales.

3. **`use-websocket.ts` (~103-122)** — en el `map` que convierte `AlertItem` a
   `NotificationEvent`, añadir `entityType: a.entityType, entityId: a.entityId` al
   objeto mapeado. Las notificaciones en vivo (`wsNotifications`) ya los traen tal cual
   del backend (fase 1) — no requieren cambio adicional.

## Validación

- No hay test de frontend específico para estos hooks (verificar con
  `grep -rl "use-websocket\|use-alerts" frontend/src` antes de asumir que no existen). Si
  no hay suite, validar manualmente en fase 3 junto con la navegación (no tiene sentido
  probar el dato sin el consumidor).

## Riesgos

- Ninguno relevante — cambio aditivo de tipos opcionales, no toca lógica de combinación
  ni el overlay de "leído".
