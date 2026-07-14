---
phase: 6
title: "Programación de pedidos: scheduler que genera borradores + notificación (sin auto-envío)"
status: pending
---

## Context

- NO existe scheduler en el backend (`@nestjs/schedule` no instalado) — infraestructura nueva
- Generación de pedido desde lista: `purchase-list.service.ts` (fase 1) — el scheduler la reutiliza
- Notificaciones: `NotificationsService` → tabla `Alert` (patrón `notifyPriceChange`)
- Decisión de producto: SIEMPRE borrador + notificación; sin envío desatendido
- Gotcha: backend corre desde dist — el cron solo vive si el proceso `start:prod` está arriba
- PDR §F8

## Requirements

1. `PurchaseSchedule`: tenantId, supplierId, listId, locationId?, daysOfWeek (int[]), timeOfDay, enabled, lastRunAt?, deletedAt. CRUD `/v1/compras/programaciones`.
2. Cron cada 5 min (`@nestjs/schedule`): busca programaciones `enabled` cuyo día/hora ya pasó hoy y `lastRunAt` anterior a hoy → genera pedido BORRADOR desde la lista (sugerencias mín/máx de fase 1) + notificación ("Pedido programado PED-N generado para <proveedor> — revisar y enviar").
3. Idempotencia: re-ejecución del tick no duplica (guard por `lastRunAt` en update condicional/transacción).
4. UI: CRUD de programaciones (días semana, hora, lista, local), próxima ejecución calculada, toggle enabled, historial simple (últimos pedidos generados por la programación — vía `PurchaseOrderEvent` type SCHEDULED_GENERATION).

## Files to modify

- `backend/package.json` — `@nestjs/schedule`
- `backend/src/app.module.ts` — `ScheduleModule.forRoot()`
- `backend/prisma/schema.prisma` + migración aditiva — `PurchaseSchedule`
- `backend/src/modules/compras/services/purchase-schedule.service.ts` (+ spec: lógica "toca ejecutar" pura y testeable con reloj inyectado)
- `backend/src/modules/compras/compras.controller.ts` + dto
- `frontend/src/app/dashboard/compras/` — tab Programaciones + `use-purchase-schedules.ts`

## Steps

1. Instalar dependencia + migración.
2. Servicio: `shouldRun(schedule, now)` puro (zona horaria Europe/Madrid — decidir si por tenant en `Configuration`; anotar decisión); ejecución transaccional con claim de `lastRunAt` (`updateMany` condicional) para evitar carreras/duplicados.
3. Generación reutilizando `generar-pedido` de fase 1 + evento SCHEDULED_GENERATION + notificación.
4. Frontend CRUD con cálculo de próxima ejecución.
5. Build + relanzar dist; prueba real con programación a hora inmediata.

## Checking (criterios de aceptación)

- [ ] Programación L-X-V 09:00 crea BORRADOR ese día/hora (prueba con hora inmediata) + notificación visible
- [ ] Reejecutar el tick manualmente (o esperar 2 ticks) NO duplica el pedido del día
- [ ] Programación `enabled=false` no ejecuta; reactivar no genera retroactivos
- [ ] El pedido generado usa cantidades sugeridas mín/máx y la oferta activa del local (fase 5 si está)
- [ ] Backend reiniciado a mitad de día: programaciones pendientes de hoy se recuperan en el siguiente tick sin duplicar las ya ejecutadas
- [ ] Nunca se envía nada al proveedor automáticamente (estado siempre BORRADOR)
- [ ] Specs de `shouldRun` + claim de idempotencia pasan; sin errores TS
- [ ] Informe en `reports/sprint-6-checking-report.md`
