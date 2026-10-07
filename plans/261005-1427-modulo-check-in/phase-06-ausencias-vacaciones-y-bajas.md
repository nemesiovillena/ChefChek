---
phase: 6
title: Ausencias vacaciones y bajas
status: completed
priority: P2
effort: 16-18h
dependencies:
  - 1
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

- [x] Solicitud → aprobación → saldo descontado y visible en el calendario (e2e + navegador)
- [x] Solapes rechazados; el empleado no puede pedir más días de los que le quedan (e2e)
- [x] Las bajas las registra gerencia; el empleado no puede registrarse una (e2e)
- [x] Saldo correcto: días naturales o laborables, festivos, medio día, alta a mitad de año, ausencia a caballo de dos años (unit + e2e)
- [x] Rechazar exige explicación; una solicitud no se decide dos veces (e2e)
- [x] Cada persona ve solo lo suyo; gestión vetada a cuentas compartidas (e2e)
- [x] `turnos` apagado por defecto y dependiente de `check-in` (e2e)
- [ ] Justificante adjunto en las bajas (pasa a la Fase 10, documentación)
- [ ] Las ausencias aprobadas aún no aparecen en el registro de jornada ni en los informes

## Risk Assessment

- Reglas de vacaciones por convenio (naturales/laborables, devengo) → configurable; documentar el valor por defecto.
- Datos de salud → no pedir diagnóstico; adjunto privado.

## Desviaciones (2026-10-07)

- **Sin adjuntos**: el justificante de una baja se gestionará con la documentación laboral (Fase 10). Aquí solo tipo y fechas; la interfaz avisa de no anotar datos de salud.
- **Sin soft-delete en `Absence`**: una ausencia no se borra, se cancela (estado `CANCELLED`, con autor y fecha).
- **`AbsenceType.employeeCanRequest`** en lugar de `requiresApproval`/`requiresAttachment`: distingue lo que pide el empleado de lo que registra gerencia.
- **Saldo sin fila = valor del convenio** (`CheckInSettings.vacationDays`), proporcional el año del alta; `LeaveBalance` solo existe cuando gerencia lo fija a mano.
- **Festivos manuales**, generales o por centro (la interfaz solo crea generales).
- **Sin notificaciones** al solicitar o decidir: se ve en la bandeja (con contador) y en "Mis ausencias".
- **Integración con jornadas pendiente**: un día de vacaciones no figura todavía en el registro de jornada, la hoja de horas ni los informes; se abordará con el planificador (Fases 7-8).
- Frontend en `src/app/dashboard/turnos/`, hooks en `src/hooks/use-turnos.ts`.
