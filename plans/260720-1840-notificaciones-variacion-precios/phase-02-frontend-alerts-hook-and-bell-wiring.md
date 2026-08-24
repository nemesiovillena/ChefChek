# Phase 02 — Frontend: hook de alertas persistidas + wire en la campana

**Status:** done (2026-07-20)
**Depende de:** Fase 01 (contrato `GET /api/v1/alerts`, `PATCH /api/v1/alerts/:id/read`)
**Owner files (exclusivos de esta fase):**
- `frontend/src/hooks/use-alerts.ts` (nuevo)
- `frontend/src/hooks/use-websocket.ts` (solo `useWebSocketNotifications`)
- `frontend/src/app/dashboard/layout.tsx` (solo el bloque de la campana, líneas ~180-225)

## Contexto verificado (file:line)

- `useWebSocketNotifications`: `frontend/src/hooks/use-websocket.ts:48-100` — hoy solo
  mantiene estado en memoria (`useState`), poblado únicamente por el evento WS
  `notification`. Se pierde al recargar o si el usuario no estaba conectado cuando se
  generó el aviso.
- Bell UI: `frontend/src/app/dashboard/layout.tsx:189-226` — consume
  `{ unreadCount, markAllAsRead, notifications }` de `useWebSocketNotifications()`
  (`:36`). `markAsRead` (individual) YA está exportado por el hook pero **no se usa** en
  el layout (los `<div>` de cada notificación no tienen `onClick`).
- Patrón de fetch a reutilizar: `frontend/src/hooks/use-product-price-history.ts` (usa
  `useApiQuery` de `frontend/src/hooks/use-api.ts:27-42`, que ya desempaqueta
  `response.data` vía interceptor global — memoria
  `frontend-api-client-paginated-unwrapping`).
- Patrón de mutación: `useApiMutation` en `use-api.ts` (`method: 'PATCH'`).
- Shape que expone el backend (fase 01):
  `{id, type: 'INFO'|'SUCCESS'|'WARNING'|'ERROR', title, message, createdAt, tenantId,
  read}` — coincide con `NotificationEvent` de `websocket-client.ts:169-179` salvo que el
  WS también trae `timestamp`/`expiresAt` opcionales (no los usa el GET, no hace falta
  añadirlos).
- `apiClient`: `frontend/src/lib/api-client.ts` (base para `useApiQuery`/`useApiMutation`,
  ya incluye `X-Tenant-Slug`/Bearer vía interceptor, memoria
  `api-testing-auth-session-tenant`).

## Pasos

1. **`use-alerts.ts` (nuevo)** — hook delgado solo para REST (histórico + persistir
   leído), sin lógica de WebSocket:
   ```ts
   'use client';
   import { useApiQuery, useApiMutation } from './use-api';

   export interface AlertItem {
     id: string;
     type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
     title: string;
     message: string;
     createdAt: string;
     tenantId: string;
     read: boolean;
   }

   export function useAlerts(limit = 50) {
     const query = useApiQuery<AlertItem[]>(['alerts', String(limit)], `/v1/alerts?limit=${limit}`);
     const markAsReadMutation = useApiMutation<AlertItem, { id: string }>(
       '/v1/alerts', 'PATCH',
     );
     return { alerts: query.data ?? [], isLoading: query.isLoading, markAsRead: markAsReadMutation.mutateAsync };
   }
   ```
   Revisar la firma exacta de `useApiMutation` en `use-api.ts` (líneas 45+, no leídas aún
   en este plan) para el URL con `:id` — puede requerir pasar la URL completa por
   variables en vez de una base fija; seguir el mismo patrón que
   `frontend/src/hooks/use-notifications.ts:34-42` (`markAsReadMutation`, aunque ese hook
   apunta a un endpoint `/v1/notifications` inexistente — no reutilizar ese hook, solo su
   patrón de mutación).

2. **`useWebSocketNotifications` (`use-websocket.ts:48-100`)** — extender para mezclar
   histórico + eventos en vivo:
   - Al montar, sembrar `notifications` con el resultado de `useAlerts(50)` (mapear
     `read` → el campo que ya usa `NotificationEvent.read` en el frontend,
     `websocket-client.ts:174`) y `unreadCount` con el conteo de `!read`.
   - El handler de WS (`notificationHandler`, `:60-77`) sigue igual, pero al insertar debe
     comprobar que el `id` no exista ya en la lista (dedupe: si el usuario ya tenía la
     lista hidratada por GET y llega el mismo evento por WS — caso borde de doble tab o
     reconexión).
   - `markAsRead`/`markAllAsRead` (`:96-110`) deben, además de actualizar el estado local,
     llamar a la mutación de `useAlerts` (`markAsRead(id)`) para persistir. Para "todas":
     iterar `notifications.filter(n => !n.read)` y disparar la mutación por cada una
     (dataset ya acotado a `limit=50`, mostrando solo 5 en UI — sin necesidad de un
     endpoint bulk, decisión ya tomada en `plan.md`).

3. **`layout.tsx:218-225`** — añadir `onClick={() => markAsRead(notif.id)}` a cada
   `<div>` de notificación (hoy no tiene ningún handler); destructurar `markAsRead` del
   hook en `:36` (hoy solo se toman `unreadCount, markAllAsRead, notifications`).

## Tests

- No hay suite de tests de frontend para hooks en este directorio (verificar con
  `find frontend -iname "*use-websocket*.test.*"` antes de asumir que hace falta crear
  uno — si no existe convención de test para hooks similares como
  `use-product-price-history.ts`, no introducir una nueva solo para este cambio).
- Verificación manual (obligatoria, UI):
  1. Levantar frontend + backend (fase 01 desplegada, `dist` rebuildeado).
  2. Editar el precio de un artículo en Artículos con €/kg distinto → la campana debe
     mostrar la notificación en <2s (WS) sin recargar.
  3. Recargar la página (F5) → la notificación sigue apareciendo (persistencia GET).
  4. Click en una notificación individual → deja de contar en `unreadCount`; recargar →
     sigue marcada como leída (persistida en backend, no solo estado local).
  5. "Marcar todas como leídas" → `unreadCount` a 0; recargar → se mantiene.
  6. Confirmar un albarán con cambio de precio >10% → sigue notificando igual que antes
     (no debe haber regresión en el flujo ya existente).

## Riesgos

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|------------|
| Notificación duplicada (GET al montar + WS llega justo después) | Media | Bajo (UX) | Dedupe por `id` al insertar vía WS |
| `useApiMutation` no soporta URL con `:id` dinámico tal como está factorizado | Media | Medio | Revisar `use-api.ts` antes de escribir el hook; si no soporta, construir la URL completa a mano como hace `use-suppliers.ts` (ver memoria `backup-delete-url-ignored-id`, mismo patrón de bug ya visto con DELETE) |
| Bell muestra `read` desincronizado entre pestañas abiertas (multi-tab) | Baja | Bajo | Fuera de alcance — no hay invalidación cross-tab hoy tampoco para otras queries |

## Rollback

Revertir cambios de código (git). Sin cambios de schema en esta fase.

## Done = observable

- Campana muestra notificaciones de cambio de precio (albarán, precio pactado, edición
  manual en Artículos) tanto en vivo como tras recargar la página.
- Marcar como leída (individual o "todas") persiste tras recargar.
- Sin regresión visible en flujos de pedidos (`orderCreated/Approved/Rejected`), que ya
  usaban el mismo canal WS `notification`.

## Resultado (2026-07-20)

Implementado tal cual el plan. `useApiMutation` no soporta URL con `:id` dinámico
(riesgo ya anticipado) — `use-alerts.ts` construye la URL a mano
(`${BASE_URL}/${id}/read`) con `useMutation` directo, mismo patrón que
`useDeleteBackup`/`use-locations.ts` (memoria `backup-delete-url-ignored-id`).

Bug adicional encontrado y corregido sobre la marcha: el bloque de la campana en
`layout.tsx` leía `notif.timestamp`, campo que el backend NUNCA envía (ni en los eventos
WS existentes de pedidos ni en los nuevos de precio — solo existe `createdAt`) →
"Invalid Date" en todas las notificaciones en vivo, incluidas las de pedidos ya
existentes antes de este cambio. Cambiado a `notif.createdAt` (un ajuste de una línea,
dentro del bloque que ya tocaba esta fase).

Verificación end-to-end con `agent-browser` (Chrome real, no headless simulado) contra el
backend levantado en `:3001` y frontend en `:3000` (hot-reload, sin rebuild):
1. Login real (`admin@chefchek.local` / tenant `chefchek-demo`) → campana muestra badge
   "9+" y las 5 alertas de cambio de precio generadas en la fase 01, con hora correcta.
2. Click en una notificación no leída → deja de resaltarse al instante (estado local).
3. Reload completo de página (nueva carga de React, sin caché de estado) → la
   notificación sigue en la lista (persistencia GET) y sigue sin resaltar (persistencia
   PATCH /read confirmada, no solo optimismo local).
4. "Marcar todas como leídas" → badge desaparece; tras otro reload completo, las 5 siguen
   sin resaltar y el badge sigue ausente.
5. Sin errores de consola (`agent-browser errors` vacío) en ningún paso; WS conectado
   (`WebSocket connected` en consola).

Sin tests de frontend nuevos (no existe convención de test para hooks similares en el
repo, confirmado por búsqueda antes de implementar — coherente con el resto de hooks en
`frontend/src/hooks/`). Sin cambios en `docs/` (mismo criterio que la fase 01).

## Ajuste post-entrega (2026-07-20): filtrar leídas + "Ver Todas"

Pedido del usuario tras la primera entrega: ocultar las notificaciones leídas del
dropdown por defecto, acortar "Marcar todas como leídas" a "Marcar Todas", y añadir un
"Ver Todas" para poder consultarlas igualmente. Sin cambios de backend/hook —
`layout.tsx` ya recibe `notifications` con `read` por elemento; se añadió estado local
`showAllNotifications` (toggle) que filtra `notifications.filter(n => !n.read)` por
defecto y muestra la lista completa (cap 20 en vez de 5, mismo contenedor con scroll) al
activarlo; el botón cambia a "Ver no leídas" para volver. Sin página ni ruta nueva
(decisión YAGNI: alcance del pedido no pedía una vista dedicada). Verificado con
agent-browser: badge y dropdown muestran solo la alerta nueva sin leer; "Ver Todas"
revela también las 4 ya marcadas como leídas en la sesión anterior.
