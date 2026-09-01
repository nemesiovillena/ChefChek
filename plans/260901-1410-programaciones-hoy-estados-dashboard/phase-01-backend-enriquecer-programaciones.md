---
phase: 1
title: 'Backend: enriquecer programaciones'
status: completed
priority: P2
dependencies: []
---

# Phase 1: Backend: enriquecer programaciones

## Overview

`GET /v1/compras/programaciones` devuelve por programación el estado HOY
calculado server-side (Madrid, consciente de `lastRunAt`) y el BORRADOR
pendiente de enviar vinculado, si existe.

## Requirements

- Functional: cada programación incluye `nextRunAt`, `runsToday`, `ranToday`,
  `pendingDraft` (ver contrato en `plan.md`).
- Non-functional: cálculo puro e inyectando reloj (testeable), reutilizando
  `getNextRunAt`; sin duplicar lógica de Madrid fuera de `toMadridParts`.

## Architecture

- Helper estático puro nuevo en `PurchaseScheduleService` (hermano de
  `shouldRun`/`getNextRunAt`): toma schedule + draft opcional + `now`, devuelve
  los 4 campos. `findAll` queda fino: query de schedules (la actual), una query
  de drafts, y map.
- El vínculo programación→BORRADOR ya existe: los pedidos generados por cron
  tienen un evento `PurchaseOrderEvent { type: "SCHEDULED_GENERATION" }` cuyo
  `payload.scheduleId` identifica la programación (mismo mecanismo que ya usa
  `dashboard.service.ts:171-220`).

## Related Code Files

- Modify: `backend/src/modules/compras/services/purchase-schedule.service.ts`
- Modify: `backend/src/modules/compras/services/purchase-schedule.service.spec.ts`
- Sin cambios en controller (`compras.controller.ts:744` ya devuelve
  `service.findAll` tal cual), DTOs ni schema.

## Implementation Steps

1. Añadir tipo de salida del helper junto a `ScheduleClockInput`:
   ```ts
   export interface ScheduleStatus {
     nextRunAt: { dateKey: string; timeOfDay: string } | null;
     runsToday: boolean;
     ranToday: boolean;
     pendingDraft: { orderId: string; generatedAt: string } | null;
   }
   ```
2. Helper estático puro:
   ```ts
   static describeSchedule(
     schedule: ScheduleClockInput,
     draft: { orderId: string; generatedAt: Date } | null,
     now: Date,
   ): ScheduleStatus {
     const today = toMadridParts(now).dateKey;
     const next = PurchaseScheduleService.getNextRunAt(schedule, now);
     return {
       nextRunAt: next,
       runsToday: next?.dateKey === today,
       ranToday: !!schedule.lastRunAt &&
         toMadridParts(schedule.lastRunAt).dateKey === today,
       pendingDraft: draft && {
         orderId: draft.orderId,
         generatedAt: draft.generatedAt.toISOString(),
       },
     };
   }
   ```
   (`runsToday` de una pausada es false porque `getNextRunAt` devuelve null.)
3. En `findAll`, tras el `findMany` actual, una query de drafts pendientes:
   ```ts
   const drafts = await this.prisma.purchaseOrder.findMany({
     where: {
       tenantId,
       status: "BORRADOR",
       events: { some: { type: "SCHEDULED_GENERATION" } },
     },
     include: {
       events: {
         where: { type: "SCHEDULED_GENERATION" },
         select: { payload: true },
         orderBy: { createdAt: "desc" },
         take: 1,
       },
     },
   });
   const draftBySchedule = new Map<string, { orderId: string; generatedAt: Date }>();
   for (const d of drafts) {
     const sid = (d.events[0]?.payload as { scheduleId?: string } | undefined)?.scheduleId;
     if (sid) draftBySchedule.set(sid, { orderId: d.id, generatedAt: d.createdAt });
   }
   ```
   Si el mismo schedule generó dos drafts sin enviar (edge), Map se queda el
   último del array — aceptable, mismo criterio "más antiguo primero" lo gestiona
   el dashboard; aquí basta señalizar que hay pendiente.
4. Devolver schedules mapeados: `{ ...schedule, ...describeSchedule(schedule, draftBySchedule.get(schedule.id) ?? null, new Date()) }`.
5. Specs: casos para `describeSchedule` con reloj inyectado —
   - corre hoy más tarde → `runsToday: true`, `pendingDraft: null`;
   - ya corrió hoy (lastRunAt hoy, pasado timeOfDay) → `nextRunAt` futuro,
     `ranToday: true`;
   - draft pendiente → `pendingDraft` relleno;
   - pausada / sin días → `nextRunAt: null`, flags false;
   - caso frontera: `now` cruzando medianoche UTC vs Madrid (instante 23:30
     UTC = 01:30 Madrid del día siguiente).

## Success Criteria

- [ ] `GET /v1/compras/programaciones` devuelve los 4 campos por item.
- [ ] `describeSchedule` puro, sin acceso a Prisma ni a `new Date()` interno.
- [ ] Specs nuevos en verde (jest, no bun test — ver memoria del repo).

## Risk Assessment

- Query extra por listado: 1 query indexada por tenant; el listado es pequeño
  (decenas). Despreciable.
- Payload de evento sin `scheduleId` (programación borrada): `findOne` por
  scheduleId ausente → draft no vinculable, no se muestra. Correcto.
