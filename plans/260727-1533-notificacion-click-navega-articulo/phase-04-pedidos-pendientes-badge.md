# Fase 4: Badge "por revisar" en la card Pedidos Pendientes

## Contexto

`dashboard.service.ts:152-158` cuenta `PurchaseOrder` en `ENVIADO`/`RECIBIDO_PARCIAL`
como "Pedidos Pendientes" (pendientes de **recepción**). Los pedidos generados por
`PurchaseScheduleService.tryGenerate` (`purchase-schedule.service.ts:200-224`) nacen en
`BORRADOR` ("nunca envía nada al proveedor") y no entran en ese conteo — semánticamente
correcto (no están pendientes de recepción, están pendientes de revisión/envío), pero
hoy no tienen ninguna representación visual en el dashboard pese a generar una alerta
("Pedido programado generado").

Decisión de alcance del badge (criterio propio, sin instrucción explícita del usuario
más allá de "lo mejor que tú decidas"): contar solo `BORRADOR` que se originaron en una
programación automática (tienen un `PurchaseOrderEvent` con `type: "SCHEDULED_GENERATION"`,
ver `purchase-schedule.service.ts:211-217`), no todos los `BORRADOR` sin más. Un pedido
`BORRADOR` creado manualmente por un usuario que sigue editándolo no es "algo olvidado
que reclama atención" — inflar el badge con eso lo haría ruido, no señal.

## Archivos a modificar

- `backend/src/modules/dashboard/dashboard.service.ts` (`calculateKPIs`, junto a
  `pendingOrders` ~152-158)
- `frontend/src/hooks/use-dashboard-kpis.ts` (`KPIs` interface)
- `frontend/src/app/dashboard/page.tsx` (card "Pedidos Pendientes", ~líneas 125-138)

**Corrección tras implementar:** `frontend/src/types/api.types.ts` (`DashboardKPIs`) NO
se toca — es un tipo huérfano (grep solo lo encuentra por coincidir con el nombre del
hook `useDashboardKPIs`, no está importado en ningún componente). El flujo real usa la
interfaz local `KPIs` de `use-dashboard-kpis.ts`.

## Pasos

1. **Backend** — junto a la query de `pendingOrders`, añadir:
   ```ts
   const scheduledDraftOrders = await this.prisma.purchaseOrder.count({
     where: {
       tenantId,
       status: "BORRADOR",
       events: { some: { type: "SCHEDULED_GENERATION" } },
     },
   });
   ```
   Añadir `scheduledDraftOrders` al objeto `kpis` devuelto (~línea 228, junto a
   `pendingOrders`). Confirmado: `PurchaseOrder.events` (`schema.prisma:2110`) es la
   relación inversa hacia `PurchaseOrderEvent[]` — el `some` de arriba usa el nombre
   correcto.

2. **Frontend types** — añadir `scheduledDraftOrders: number;` a `KPIs`
   (`use-dashboard-kpis.ts`) y a `DashboardKPIs` (`api.types.ts`).

3. **`dashboard/page.tsx`** — en la card "Pedidos Pendientes" (~línea 125), añadir
   `relative` al className del `<div onClick>` y, dentro, un badge condicional
   reusando el mismo estilo que el badge de la campana (`layout.tsx:186-189`, DRY):
   ```tsx
   {!!kpis?.scheduledDraftOrders && kpis.scheduledDraftOrders > 0 && (
     <span className="absolute -top-1 -right-1 bg-error text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
       {kpis.scheduledDraftOrders > 9 ? '9+' : kpis.scheduledDraftOrders}
     </span>
   )}
   ```
   Sin `animate-pulse` (reservar esa señal más urgente para el badge de la campana, que
   ya la usa) — decisión de diseño menor, ajustar si la revisión visual pide lo
   contrario.

## Validación

- `bun run test` en `backend/` — si existe `dashboard.service.spec.ts`, verificar que
  sigue en verde y opcionalmente añadir un caso para `scheduledDraftOrders`.
- Manual: generar un pedido programado (o insertar directamente un `PurchaseOrder`
  `BORRADOR` + `PurchaseOrderEvent` `SCHEDULED_GENERATION` vía Prisma Studio/SQL para no
  esperar al cron), refrescar `/dashboard`, confirmar que el badge aparece con el
  conteo correcto. Cambiar el pedido a `ENVIADO` (enviarlo) y confirmar que el badge
  desaparece tras el refetch (30s, `refetchInterval` de `useDashboardKPIs`).

## Riesgos

- Campo nuevo en la respuesta de `/v1/dashboard/kpis` — aditivo, no rompe consumidores
  existentes.
