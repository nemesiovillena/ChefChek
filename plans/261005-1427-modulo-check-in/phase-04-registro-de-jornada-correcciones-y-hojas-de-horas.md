---
phase: 4
title: "Registro de jornada correcciones y hojas de horas"
status: pending
priority: P1
effort: "20-24h"
dependencies: [2]
---

# Phase 4: Registro de jornada, correcciones y hojas de horas

## Overview

Deriva la jornada diaria de los fichajes, permite correcciones documentadas sin alterar el original y genera hojas de horas con horas ordinarias/extra y flujo de aprobación.

## Requirements

- Funcional: ver jornada por día; solicitar/aprobar correcciones; cierre de jornadas abiertas; hoja semanal/mensual; aprobación por encargado; conformidad mensual del empleado.
- No funcional: cálculo determinista y testeado; hoja aprobada inmutable; correcciones append-only.
- Decidido: aprueba ADMIN/OWNER; la comprobación va en un único guard/helper (`canApproveCheckIn`) para poder añadir roles después sin tocar cada endpoint. Turno partido: varios tramos por día; el hueco entre tramos no computa.
- Decidido: pausas cortas computables según el interruptor `breaksCountAsWork` de Configuración; el cambio aplica a periodos abiertos, nunca a hojas aprobadas.

## Architecture

- `TimePunchAdjustment` (append-only): `kind` (`ADD|VOID|REPLACE`), `targetPunchId?`, `type?`, `occurredAt?`, `reason` (obligatorio), `requestedByUserId`, `status` (`PENDING|APPROVED|REJECTED`), `decidedByUserId?`, `decidedAt?`, `decisionNote?`. La decisión se guarda como fila nueva enlazada, no como update.
- Jornada efectiva = fichajes − anulados + añadidos aprobados. Nunca se reescribe `TimePunch`.
- `WorkdayCalculator` (función pura): entrada = fichajes efectivos + ajustes + zona horaria + reglas; salida = tramos, minutos trabajados, pausa, incidencias (`SIN_SALIDA`, `SECUENCIA_INVALIDA`, `FUERA_DE_ZONA`, `PIN_PENDIENTE`). Turno que cruza medianoche → día de inicio. DST correcto.
- Horas extra = trabajadas − pactadas del periodo (`Employee.weeklyHours`), totalizadas por semana y mes; máximos y franja nocturna tomados de los parámetros de convenio en `CheckInSettings`.
- `Timesheet`: `employeeId`, `periodStart`, `periodEnd`, `status` (`OPEN|SUBMITTED|APPROVED`), totales congelados, `approvedByUserId`, `approvedAt`, `employeeAckAt`. Trigger `forbid_mutation_after_seal` sobre `approvedAt`.
- Reapertura = nueva versión de hoja con motivo; la anterior se conserva.
- Cron (`@nestjs/schedule`): el cierre del primer tramo de un turno partido no es incidencia; jornadas abiertas más de `autoCloseAfterHours` → incidencia + aviso (no se inventa la salida); recordatorio de olvido de fichaje.

## Related Code Files

- Modify: `backend/prisma/schema.prisma`, `check-in.module.ts`, reglas de Backup
- Create: migración `<ts>_time_adjustments_timesheets` (tablas + triggers)
- Create: `backend/src/modules/check-in/services/workday-calculator.ts` (+ spec amplio), `services/adjustments.service.ts`, `services/timesheets.service.ts`, `services/open-workday.cron.ts`, `adjustments.controller.ts`, `timesheets.controller.ts`, `dto/`
- Create: `frontend/src/app/dashboard/check-in/jornadas/`, `frontend/src/app/dashboard/check-in/hojas-de-horas/`, componentes `workday-timeline.tsx`, `adjustment-request-dialog.tsx`, `timesheet-approval-table.tsx`

## Implementation Steps

1. Tests primero para `WorkdayCalculator`: jornada simple, turno partido (2+ tramos), pausas, medianoche, cambio de hora, sin salida, ajustes `ADD`/`VOID`/`REPLACE`.
2. Implementar el calculador hasta pasar los tests.
3. Modelos + migración + triggers.
4. `AdjustmentsService`: solicitar, aprobar, rechazar; notificación por `Alert`.
5. `TimesheetsService`: generar, enviar, aprobar (congela totales), reabrir con versión.
6. Cron de jornadas abiertas y recordatorios.
7. Frontend gerencia: vista de jornadas con línea temporal, bandeja de incidencias y solicitudes, tabla de aprobación de hojas.
8. Frontend empleado: mis jornadas, solicitar corrección, dar conformidad mensual.
9. e2e: olvido de salida → solicitud → aprobación → hoja correcta.

## Success Criteria

- [ ] Todos los casos del calculador en verde (incluye turno partido, medianoche y DST)
- [ ] Una corrección aprobada cambia la jornada efectiva y el original sigue visible
- [ ] Corrección sin motivo es rechazada
- [ ] Hoja aprobada no se puede modificar en BD
- [ ] Jornada sin salida genera incidencia y aviso, sin hora inventada
- [ ] Horas extra semanales y mensuales coinciden con un cálculo manual de control

## Risk Assessment

- Errores de cálculo → impacto legal y económico. Mitigar con TDD en el calculador y caso de control manual.
- Reglas de pausas dependientes de convenio → configurable, valor por defecto explícito.
- Aprobador único (ADMIN) insuficiente a futuro → permiso centralizado en un helper, ampliable.
