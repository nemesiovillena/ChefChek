---
phase: 2
title: "Fichaje online personal y kiosco con PIN y geovalla"
status: pending
priority: P1
effort: "18-22h"
dependencies: [1]
---

# Phase 2: Fichaje online (personal y kiosco) con PIN y geovalla

## Overview

Registro de fichajes append-only con cadena de hash, desde dispositivo personal o kiosco compartido, con PIN y comprobación de geovalla. Requiere conexión (offline llega en Fase 3).

## Requirements

- Funcional: fichar entrada/salida/pausa; sesión personal sin PIN; kiosco con selección de empleado + PIN obligatorio; varios tramos al día (turno partido); estado actual del empleado; presencia en vivo para gerencia.
- No funcional: `TimePunch` inmutable en BD; idempotencia por UUID de cliente; respuesta < 500 ms; límite de peticiones en verificación de PIN.

## Architecture

- `TimePunch`: `id` (UUID generado en cliente), `tenantId`, `employeeId`, `type` (`IN|OUT|BREAK_START|BREAK_END`), `occurredAt` (hora dispositivo, UTC), `receivedAt` (servidor), `source` (`PERSONAL|KIOSK|MANAGER`), `recordedByUserId`, `locationId?`, `latitude?`, `longitude?`, `accuracyM?`, `geofenceStatus` (`INSIDE|OUTSIDE|UNAVAILABLE|OFF`), `distanceM?`, `deviceId?`, `userAgent?`, `wasOffline`, `pinStatus` (`VERIFIED|NOT_REQUIRED|PENDING_REVIEW`), `seq` (por tenant), `prevHash`, `hash`. Sin `updatedAt` ni `deletedAt`.
- Trigger `forbid_mutation()` sobre `time_punches`.
- Hash: `sha256(prevHash + campos canónicos)`, encadenado por tenant en orden de `seq`; inserción dentro de transacción con bloqueo por tenant (`pg_advisory_xact_lock`).
- PIN: `NOT_REQUIRED` en `source = PERSONAL` (identidad = sesión); obligatorio y verificado en `KIOSK`.
- Validación de secuencia: no `IN` si ya está dentro, no `OUT` si está fuera, etc.; varios pares `IN`/`OUT` el mismo día son válidos. Secuencia inválida → 409 con estado actual.
- Geovalla: distancia haversine en servidor; modo `BLOCK` rechaza `OUTSIDE`; `UNAVAILABLE` nunca bloquea.
- Kiosco: sesión de `User.isSharedAccount`; `GET /check-in/kiosk/employees` devuelve solo nombre e id; PIN obligatorio.
- Presencia en vivo: evento por socket.io existente al grabar fichaje.
- Bloqueo por configuración: `PunchService` consulta `CheckInReadinessService.isReady`; si los textos legales no están validados responde 409 `CONFIG_PENDING` y la interfaz lo explica.
- Aviso informativo: la primera vez que un empleado ficha desde su sesión ve el texto vigente y deja acuse (`CheckInLegalAck`); en kiosco el texto está accesible desde la pantalla.
- Centro del fichaje: en sesión personal, el centro asignado más cercano a las coordenadas (o el único asignado); en kiosco, el centro elegido al preparar el dispositivo.

## Related Code Files

- Modify: `backend/prisma/schema.prisma`, `backend/src/modules/check-in/check-in.module.ts`
- Create: migración `<ts>_time_punches` (tabla + trigger + índices `(tenantId, employeeId, occurredAt)`)
- Create: `backend/src/modules/check-in/punches.controller.ts`, `services/punch.service.ts`, `services/punch-hash-chain.service.ts`, `services/geofence.util.ts`, `services/employee-status.service.ts`, `dto/create-punch.dto.ts` + specs
- Create: `frontend/src/app/fichar/` (kiosco, pantalla completa), `frontend/src/features/check-in/components/punch-button.tsx`, `pin-pad.tsx`, `use-geolocation.ts`, `use-punch.ts`
- Create: `frontend/src/app/dashboard/check-in/page.tsx` (presencia en vivo)

## Implementation Steps

1. Modelo + migración con trigger; test que confirma que `UPDATE`/`DELETE` fallan.
2. `PunchHashChainService` y `geofence.util` con tests unitarios.
3. `PunchService.create`: idempotencia por `id`, validación de secuencia, PIN (solo kiosco), geovalla, hash, emisión de evento.
4. Endpoints: `POST /check-in/punches`, `GET /check-in/me/status`, `GET /check-in/presence`, `GET /check-in/kiosk/employees`.
5. Throttling en rutas de kiosco con PIN (`@nestjs/throttler` ya instalado).
6. Frontend personal: botón único según estado, sin PIN, permiso de ubicación con explicación previa y degradación si se deniega.
7. Frontend kiosco `/fichar`: rejilla de empleados, teclado PIN (inputs ≥16px), confirmación con hora, vuelta automática al inicio.
8. Panel de presencia: dentro / en pausa / fuera, con marca de fuera de zona.
9. e2e: fichaje personal, kiosco, PIN incorrecto, reintento idempotente.

## Success Criteria

- [ ] Fichaje personal (sin PIN) y en kiosco (con PIN) desde móvil, tablet y ordenador
- [ ] Un intento de fichaje de kiosco sin PIN es rechazado por el servidor
- [ ] Dos tramos el mismo día (turno partido) se registran sin error
- [ ] `UPDATE`/`DELETE` sobre `time_punches` rechazados por la BD
- [ ] Reenviar el mismo UUID no duplica
- [ ] Geovalla: `INSIDE`/`OUTSIDE`/`UNAVAILABLE` correctos; modo `BLOCK` rechaza
- [ ] Presencia en vivo se actualiza sin recargar
- [ ] Un USER no puede fichar por otro empleado desde sesión personal
- [ ] Con textos legales sin validar, fichar devuelve `CONFIG_PENDING`
- [ ] Empleado con dos centros: el fichaje queda asociado al centro correcto

## Risk Assessment

- Condición de carrera en `seq`/hash con fichajes simultáneos → bloqueo por tenant en transacción.
- Permiso de ubicación denegado → no bloquear, marcar `UNAVAILABLE`.
- Kiosco expone lista de nombres → solo a sesiones de cuenta compartida o ADMIN.
