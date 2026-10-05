---
phase: 6
title: "Ausencias vacaciones y bajas"
status: pending
priority: P2
effort: "16-18h"
dependencies: [1]
---

# Phase 6: Ausencias, vacaciones y bajas

## Overview

Primer bloque del módulo `turnos`: tipos de ausencia, saldos de vacaciones, solicitudes con aprobación, bajas con justificante y festivos por centro.

## Requirements

- Funcional: configurar tipos; solicitar y aprobar ausencias; registrar bajas; saldo anual; calendario de equipo; festivos.
- No funcional: justificantes en almacenamiento privado; no guardar diagnósticos ni datos de salud, solo tipo y fechas.

## Architecture

- `AbsenceType`: `name`, `color`, `deductsBalance`, `requiresApproval`, `requiresAttachment`, `isPaid`, `isActive`. Semilla por tenant: Vacaciones, Baja IT, Permiso retribuido, Asuntos propios, Ausencia no justificada.
- `Absence`: `employeeId`, `absenceTypeId`, `startDate`, `endDate`, `halfDay?`, `status` (`PENDING|APPROVED|REJECTED|CANCELLED`), `note?`, `attachmentKey?`, `requestedByUserId`, `decidedByUserId?`, `decidedAt?`. Soft-delete.
- `LeaveBalance`: `employeeId`, `year`, `entitledDays`, `carriedOverDays`, `adjustmentDays`; disfrutados y pendientes se calculan desde `Absence`.
- `Holiday`: `locationId?`, `date`, `name`.
- Días de vacaciones y cómputo (naturales/laborables): valores del convenio configurado en `CheckInSettings`, editables.
- Solapes: una ausencia aprobada no se solapa con otra del mismo empleado.
- Adjuntos: `store-private-attachment.util.ts`.

## Related Code Files

- Modify: `backend/prisma/schema.prisma`, `backend/src/app.module.ts`, reglas de Backup y Papelera, `section-registry.ts` (`turnos`, `turnos.absences`, `turnos.approve`), `nav-config.ts`
- Create: migración `<ts>_absences`
- Create: `backend/src/modules/turnos/` (`turnos.module.ts`, `absences.controller.ts`, `services/absences.service.ts`, `services/leave-balance.service.ts`, `services/holidays.service.ts`, `dto/`) + specs
- Create: `frontend/src/features/turnos/`, `frontend/src/app/dashboard/turnos/ausencias/`

## Implementation Steps

1. Modelos, migración y semilla de tipos (idempotente, al activar el módulo).
2. `AbsencesService`: solicitar, aprobar, rechazar, cancelar; validación de solapes y de saldo.
3. `LeaveBalanceService`: cálculo de saldo con tests (cambio de año, medio día, prorrateo por fecha de alta).
4. Festivos por centro (alta manual; importación automática fuera de alcance).
5. Notificaciones por `Alert` al solicitar y al decidir.
6. Frontend gerencia: bandeja de solicitudes, calendario mensual de equipo, saldos, alta de bajas con justificante.
7. Frontend empleado: solicitar, ver estado y saldo (se integra en el portal en la Fase 9).
8. Integración con Fase 4: un día con ausencia aprobada no genera incidencia de "sin fichaje".

## Success Criteria

- [ ] Solicitud → aprobación → saldo descontado y visible en calendario
- [ ] Solapes rechazados
- [ ] Baja con justificante accesible solo para gerencia y el propio empleado
- [ ] Saldo correcto en casos de prueba (alta a mitad de año, medio día)
- [ ] `turnos` no activable sin `check-in`

## Risk Assessment

- Reglas de vacaciones por convenio (naturales/laborables, devengo) → configurable; documentar el valor por defecto.
- Datos de salud → no pedir diagnóstico; adjunto privado.
