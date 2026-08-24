# Fase 3 — Card "Notificaciones y Alertas" con feed real

## Archivos
- `frontend/src/app/dashboard/page.tsx`

## Pasos
1. Capturar el retorno de `useWebSocketNotifications()` (ya se llama en la
   línea 23 pero se descarta): `const { notifications } = useWebSocketNotifications();`
2. Quitar `useRealTimeProduction()` / `useRealTimeStock()` de esta página
   (dead: sin emisor backend real, ver plan.md). No tocar los hooks en
   `use-websocket.ts` (fuera de alcance).
3. Reemplazar el bloque de `productionAlerts`/`stockAlerts` por un listado
   de `notifications.slice(0, 4)` con el mismo estilo de card (icono según
   severidad: CRITICAL/ERROR → error, WARNING → warning, resto → info).
4. Estado vacío: "No hay notificaciones" cuando `notifications.length === 0`.

## Validación
- Generar una alerta real (p.ej. bajada de stock vía `almacenes.service.ts`
  o alerta de precio) y confirmar que aparece tanto en la campana como en
  esta card.
