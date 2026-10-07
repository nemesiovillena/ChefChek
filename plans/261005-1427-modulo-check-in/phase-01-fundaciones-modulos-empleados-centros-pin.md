---
phase: 1
title: Fundaciones modulos empleados centros PIN
status: completed
priority: P1
effort: 16-20h
dependencies: []
---

# Phase 1: Fundaciones: módulos, empleados, centros, PIN y Configuración

## Overview

Registra los tres módulos, crea la ficha laboral `Employee`, amplía `Location` como centro de trabajo con geovalla, añade el PIN de kiosco y la pantalla de Configuración (convenio, pausas, centros, textos legales). Sin fichaje todavía.

## Requirements

- Funcional:
  - módulos `check-in`, `turnos`, `rrhh` activables por tenant (`turnos` y `rrhh` dependen de `check-in`)
  - CRUD de empleados; asignación a uno o varios centros
  - asignar/restablecer PIN (usado solo en kiosco)
  - Configuración: elegir convenio y editar sus parámetros; interruptor de pausas computables; coordenadas, radio y modo de geovalla por centro; revisar, editar y validar textos legales
  - el módulo queda en "configuración pendiente" hasta validar los textos obligatorios
- No funcional: migración aditiva; DNI/NAF visibles solo para OWNER/ADMIN; PIN nunca en claro ni en logs; Configuración solo ADMIN/OWNER a través de un único helper de permiso (ampliable a otros roles).

## Architecture

- `Employee`: `tenantId`, `userId?` (único), `firstName`, `lastName`, `nationalId?`, `socialSecurityNumber?`, `jobTitle?`, `section?`, `contractType?`, `weeklyHours`, `hourlyCost?`, `defaultLocationId?`, `hireDate?`, `terminationDate?`, `pinHash?`, `pinFailedAttempts`, `pinLockedUntil?`, `isActive`, `deletedAt`.
- `EmployeeLocation`: `employeeId`, `locationId` (único compuesto). Con un solo centro en el tenant se crea sola y la interfaz no la muestra.
- `Location` += `latitude?`, `longitude?`, `geofenceRadiusM?` (def. 150), `geofenceMode` (`OFF|WARN|BLOCK`, def. `WARN`), `timezone` (def. `Europe/Madrid`).
- `CheckInSettings` por tenant (fila única): `agreementKey`, `annualHours`, `weeklyHours`, `maxDailyHours`, `minRestBetweenShiftsHours`, `weeklyRestDays`, `nightStart`, `nightEnd`, `vacationDays`, `vacationDayType` (`NATURAL|WORKING`), `overtimeYearlyCap`, `breaksCountAsWork` (def. false), `autoCloseAfterHours`, `pinLength`.
- Plantillas de convenio: constante en código `LABOR_AGREEMENT_PRESETS` (`hosteleria`, `personalizado-et`). Elegir una copia sus valores a `CheckInSettings`; a partir de ahí son editables. No hay motor de reglas ni tabla de convenios. Valores de `hosteleria` pendientes de las cifras del convenio de Warynessy; hasta tenerlas, parte de los del Estatuto con aviso de revisión.
- `CheckInLegalText`: `tenantId`, `kind` (`REGISTRO_JORNADA_INFO|GEOLOCALIZACION|PROTOCOLO_REGISTRO`), `version`, `content`, `validatedByUserId?`, `validatedAt?`, `isCurrent`. Editar crea versión nueva sin validar; la última validada sigue vigente.
- `CheckInLegalAck` (append-only): `legalTextId`, `employeeId`, `ackAt`.
- `CheckInReadinessService.isReady(tenantId)`: verdadero si cada `kind` obligatorio tiene una versión validada. Lo consultará el fichaje (Fase 2).
- PIN: `bcrypt` (ya instalado), 5 intentos → bloqueo 15 min; ADMIN restablece; el empleado lo cambia con su sesión.
- `StaffMember` (stub de producción) no se toca.

## Related Code Files

- Modify: `backend/prisma/schema.prisma`, `backend/src/modules/modules/constants/registry.ts`, `backend/src/modules/role-access/constants/section-registry.ts`, `backend/src/app.module.ts`, `frontend/src/features/modules/lib/nav-config.ts`
- Modify: reglas de scope del módulo `backup` y entidades de `trash` (añadir `Employee`)
- Create: `backend/prisma/migrations/<ts>_check_in_foundations/migration.sql` (incluye trigger `forbid_mutation` en `check_in_legal_acks`)
- Create: `backend/src/modules/check-in/` (`check-in.module.ts`, `employees.controller.ts`, `settings.controller.ts`, `legal-texts.controller.ts`, `services/employees.service.ts`, `services/employee-pin.service.ts`, `services/check-in-settings.service.ts`, `services/legal-texts.service.ts`, `services/check-in-readiness.service.ts`, `constants/labor-agreement-presets.ts`, `constants/legal-text-drafts.ts`, `util/can-manage-check-in.ts`, `dto/`)
- Create: `frontend/src/features/check-in/` (hooks, tipos), `frontend/src/app/dashboard/check-in/empleados/`, `frontend/src/app/dashboard/check-in/configuracion/` (pestañas Convenio / Jornada y pausas / Centros / Textos legales)

## Implementation Steps

1. Añadir modelos y campos a `schema.prisma`; generar migración con `prisma migrate diff` (sin TTY).
2. Registrar módulos en `registry.ts` con dependencias; secciones `checkin`, `checkin.employees`, `checkin.reports`, `checkin.cost` en `section-registry.ts`.
3. `CheckInModule` importando `AuthModule`; `@RequireModule("check-in")`; helper `canManageCheckIn`.
4. `EmployeesService`: CRUD, vínculo opcional con `User` (mismo tenant, unicidad), asignación a centros, baja con `terminationDate`.
5. `EmployeePinService`: set/reset/verify con bloqueo; tests unitarios.
6. `CheckInSettingsService` + plantillas de convenio; test: elegir plantilla copia valores, editar no altera la plantilla.
7. `LegalTextsService`: sembrar borradores al activar el módulo (idempotente), editar → versión nueva, validar, `isReady`; tests.
8. Endpoint de centros: `PATCH` de campos geo sobre `Location` existente.
9. Frontend: listado y modal de empleado; Configuración con cuatro pestañas (`role="tablist"`), botón "usar mi ubicación actual", editor de texto legal con estado Borrador/Validado y aviso de "configuración pendiente".
10. Actualizar reglas de Backup y Papelera; test de backup de tenant.

## Success Criteria

- [x] El módulo `check-in` aparece en superadmin y responde 403 apagado (e2e). `turnos`/`rrhh` se registran al empezar su oleada (ver Desviaciones)
- [x] Crear, editar y dar de baja un empleado; vincularlo a un usuario; asignarlo a dos centros (e2e)
- [x] PIN: asignar, verificar, bloqueo tras 5 fallos, restablecer (unit + e2e)
- [x] Elegir "Hostelería" rellena los parámetros y se pueden editar (e2e)
- [x] Interruptor de pausas se guarda y se lee (e2e)
- [x] `isReady` es falso hasta validar todos los textos; un USER no puede validar (e2e)
- [x] Editar un texto validado crea versión nueva y conserva la anterior (e2e)
- [ ] Backup de tenant y restore funcionan con las tablas nuevas
- [x] Migración aditiva aplicada en dev y en `chefchek_test`; jest en verde
- [ ] Pantallas revisadas en navegador con sesión real (pendiente: sin credenciales de dev válidas)

## Risk Assessment

- Vínculo `Employee`↔`User` mal resuelto → fichajes a nombre equivocado. Mitigar: unicidad en BD y validación de tenant.
- Valores de convenio incorrectos → editables, con aviso de revisión; cifras reales pendientes de la gestoría.
- Borradores legales tomados como definitivos → etiquetados como orientativos; registro de quién valida.
- Reglas de Backup olvidadas → restore con error PG. Mitigar: paso 10 obligatorio con test.

## Desviaciones respecto al diseño inicial (2026-10-05)

- `Employee` sin `deletedAt` y fuera de Papelera: un empleado nunca se borra (conservación 4 años); solo baja con `isActive=false` + `terminationDate`.
- Solo se registra el módulo `check-in`. `turnos` y `rrhh` se añadirán al registro cuando empiece su oleada, para no ofrecer en superadmin módulos vacíos.
- `CheckInLegalAck` (acuse del empleado) pasa a la Fase 2, donde se usa por primera vez; con él se añadirá su trigger y su entrada como tabla de evidencia en Backup.
- Sin reglas nuevas en Backup: las cuatro tablas llevan `tenantId` y el backup las descubre solo. Restore con estas tablas no se ha probado todavía.
- Sin `CheckInReadinessService` aparte: es `LegalTextsService.getReadiness`.
- Centros: se reutiliza `LocationsService` de Compras (provisto directamente en `CheckInModule`) más `WorkCentersService` para la geovalla.
- Frontend: hooks en `src/hooks/use-check-in.ts` y tipos en `src/lib/check-in-types.ts`, siguiendo la convención real del repo (no `src/features/check-in/`).
- Validar un texto con campos `[ENTRE CORCHETES]` sin completar se rechaza.
