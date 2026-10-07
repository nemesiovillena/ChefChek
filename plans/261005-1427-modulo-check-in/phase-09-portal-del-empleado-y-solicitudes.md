---
phase: 9
title: "Portal del empleado y solicitudes"
status: pending
priority: P3
effort: "14-16h"
dependencies: [4, 6]
---

# Phase 9: Portal del empleado y solicitudes

## Overview

Primer bloque del módulo `rrhh`: "Mi espacio", un único punto donde el empleado ficha y consulta sus fichajes, turnos, ausencias, datos, solicitudes y notificaciones.

## Requirements

- Funcional: inicio con estado de fichaje y próximos turnos; mis fichajes y hojas; mis turnos; mis ausencias y saldo; mis datos (con solicitud de cambio); mis solicitudes; notificaciones.
- No funcional: pensado primero para móvil; un empleado jamás accede a datos de otro; funciona con los módulos que estén activos (si `turnos` está apagado, sus apartados no aparecen).

## Architecture

- `EmployeeRequest`: `employeeId`, `kind` (`PUNCH_ADJUSTMENT|ABSENCE|DATA_CHANGE|OTHER`), `refId?` (apunta al ajuste o ausencia), `payload?` (JSON para cambio de datos), `status`, `decidedByUserId?`, `decisionNote?`. Vista unificada sobre los flujos ya existentes; no duplica su lógica.
- Todas las rutas `/rrhh/me/*` resuelven el empleado desde la sesión (`Employee.userId`); nunca aceptan `employeeId` del cliente.
- Cambio de datos personales: el empleado propone, ADMIN aprueba y entonces se aplica a `Employee`/`User`.
- Notificaciones: reutiliza `Alert` + campana existente, filtradas al usuario.
- Navegación móvil: respeta el menú inferior fijo.

## Related Code Files

- Modify: `backend/prisma/schema.prisma`, `backend/src/app.module.ts`, `section-registry.ts`, `nav-config.ts`, reglas de Backup
- Create: migración `<ts>_employee_requests`
- Create: `backend/src/modules/rrhh/` (`rrhh.module.ts`, `me.controller.ts`, `requests.controller.ts`, `services/employee-self.service.ts`, `services/employee-requests.service.ts`, `dto/`) + specs
- Create: `frontend/src/features/rrhh/`, `frontend/src/app/dashboard/mi-espacio/` (inicio, fichajes, turnos, ausencias, datos, solicitudes), `frontend/src/app/dashboard/rrhh/solicitudes/` (bandeja de gerencia)

## Implementation Steps

1. Modelo y migración; `RrhhModule` con `AuthModule`.
2. `EmployeeSelfService` + tests de aislamiento (usuario A no lee nada de B; usuario sin `Employee` recibe estado vacío controlado).
3. Solicitudes unificadas enlazando ajustes (Fase 4) y ausencias (Fase 6).
4. Flujo de cambio de datos con aprobación.
5. Páginas de "Mi espacio" reutilizando componentes de fases previas.
6. Bandeja única de solicitudes para gerencia.
7. Acceso directo: tras iniciar sesión, un USER con `Employee` aterriza en "Mi espacio".
8. e2e de aislamiento y de flujo completo en viewport móvil.

## Success Criteria

- [ ] El empleado hace todo desde "Mi espacio" sin entrar en otras secciones
- [ ] Tests de aislamiento en verde
- [ ] Apartados de `turnos` desaparecen si el módulo está apagado
- [ ] Solicitud de cambio de datos no se aplica hasta aprobarse
- [ ] Usable con una mano en móvil

## Risk Assessment

- Fuga de datos entre empleados → empleado siempre derivado de la sesión; tests dedicados.
- Duplicar lógica de solicitudes → `EmployeeRequest` solo referencia, no reimplementa.
