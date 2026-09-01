---
title: 'Programaciones de pedidos: estados HOY y aviso en dashboard'
description: >-
  Desambiguar 'Próxima' en el listado de programaciones (3 estados de fila con
  cálculo server-side) y reforzar la card 'Pedidos Pendientes' del dashboard con
  chip HOY. Sin popup (decisión del usuario). Sin cambios de schema.
status: completed
priority: P2
branch: develop
tags:
  - compras
  - programaciones
  - dashboard
blockedBy: []
blocks: []
created: '2026-09-01T12:13:08.696Z'
createdBy: 'ck:plan'
source: skill
---

# Programaciones de pedidos: estados HOY y aviso en dashboard

## Overview

Problema (reportado por el usuario): con dos programaciones activas, la etiqueta
"Próxima: <fecha>" del listado no indica cuál hay que enviar hoy. Además, el
aviso del dashboard es una línea de 11px fácil de pasar por alto.

Causa raíz verificada:
1. El listado calcula "próxima" con una función cliente propia
   (`nextRun()` en `programaciones-tab.tsx:21-43`) que ignora `lastRunAt` y usa
   zona horaria del navegador — puede discrepar del cron real (backend,
   Europe/Madrid).
2. Cuando el cron ya corrió hoy, "Próxima" salta a la semana siguiente mientras
   el BORRADOR sigue pendiente de enviar — el listado no distingue ese estado.

Solución (confirmada con el usuario vía /ask):
- **Una sola fuente de verdad**: el backend devuelve `nextRunAt`, `runsToday`,
  `ranToday` y `pendingDraft` por programación (reutiliza
  `PurchaseScheduleService.getNextRunAt`, puro y ya testeado). Se elimina
  `nextRun()` del cliente.
- **3 estados de fila** en el listado (decisión del usuario):
  1. `pendingDraft` → "Pendiente de enviar · generado hoy HH:mm" — error, negrita.
  2. `runsToday` (sin draft) → "Hoy · HH:mm" — negrita, color primary.
  3. Resto → "Próxima: …" como ahora.
- **Card reforzada en dashboard** (decisión del usuario: SIN popup ni modal):
  chip "HOY" + énfasis diferenciando "pendiente de enviar" (error) de "corre
  hoy" (primary). El badge rojo de drafts ya existe y se conserva.

Semántica clave: la programación no exige acción a HH:mm — el cron genera un
BORRADOR y la acción humana es revisarlo y enviarlo. Por eso el estado
accionable ("pendiente de enviar") tiene prioridad visual sobre "corre hoy".

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Backend: enriquecer programaciones](./phase-01-backend-enriquecer-programaciones.md) | Completed |
| 2 | [Frontend: estados de fila HOY](./phase-02-frontend-estados-de-fila-hoy.md) | Completed |
| 3 | [Dashboard: card reforzada](./phase-03-dashboard-card-reforzada.md) | Completed |
| 4 | [Verificación](./phase-04-verificaci-n.md) | Completed |

## Dependencies

Ninguna. Sin solapamiento con planes vivos (permisos-por-rol toca role-access,
no compras/dashboard-kpis). Sin cambios de schema ni migraciones.

## Contrato nuevo (resumen)

`GET /v1/compras/programaciones` — cada item añade:

```ts
nextRunAt: { dateKey: string; timeOfDay: string } | null; // Madrid; null si pausada/sin días
runsToday: boolean;    // nextRunAt.dateKey === hoy (Madrid)
ranToday: boolean;     // toMadridParts(lastRunAt).dateKey === hoy (Madrid)
pendingDraft: { orderId: string; generatedAt: string } | null; // BORRADOR con evento SCHEDULED_GENERATION (payload.scheduleId)
```

Dashboard KPIs (`nextScheduledPurchase`) añade: `isToday: boolean`,
`isPendingDraft: boolean`.

## Acceptance Criteria

- [ ] Con dos programaciones activas el mismo día, el listado identifica sin
      ambigüedad cuál tiene draft pendiente de enviar y cuál corre hoy.
- [ ] "Próxima" del listado nunca contradice al cron (misma zona horaria y
      mismo `lastRunAt` que `getNextRunAt`).
- [ ] Cero lógica de zona horaria nueva en el cliente.
- [ ] La card del dashboard muestra chip "HOY" + énfasis según estado; sin
      popup/modal/toast bloqueante.
- [ ] Specs backend del cálculo enriquecido en verde; typecheck/build frontend OK.
