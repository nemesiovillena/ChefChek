# Fase 1 — Equipo como fuente de datos (backend)

## Contexto
- `backend/src/modules/users/users.service.ts` (`create` L19, `update` L203, `remove` L259)
- `backend/src/modules/check-in/services/employees.service.ts` (`importFromUsers`, `create`, `resolveLocationIds`)
- `backend/prisma/schema.prisma` → `User`, `Employee`

## Requisitos
- Con cuenta enlazada, el nombre de la ficha es siempre `User.name`. `firstName/lastName` solo rigen en fichas sin cuenta.
- `User.isActive=false` o baja (soft-delete) ⇒ ficha inactiva. Reactivar usuario ⇒ ficha activa.
- Alta de usuario personal (no compartido, tenant con módulo `check-in` activo) ⇒ ficha creada con centro por defecto.
- Marcar un usuario como cuenta compartida ⇒ se desvincula de la ficha (regla ya existente: una compartida no es una persona).

## Ficheros
- Modificar: `employees.service.ts` (serializador: nombre derivado; `ensureForUser(tenantId, user)`; `syncFromUser`).
- Modificar: `users.service.ts` (llamar a `ensureForUser`/`syncFromUser` tras create/update/remove). `UsersModule` importa el provider exportado por `CheckInModule` (ojo: exigir también `exports`).
- Modificar: `employees.service.spec.ts`, `users.service.spec.ts`.

## Pasos
1. Serializador de `Employee`: si `user` enlazado, `firstName/lastName` = `splitFullName(user.name)`; añadir `displayName`.
2. `ensureForUser`: idempotente; no crea si ya hay ficha, si es compartida o si el módulo no está activo.
3. `syncFromUser`: propaga `isActive`; en `update` de `name` no escribe nada (se deriva).
4. Engancharlo en `UsersService` dentro de la misma transacción cuando sea posible. Borrado: usar `.update({deletedAt})`, no `delete` en transacción.
5. Informes (`report.service.ts`, `report-export.service.ts`): confirmar que leen el nombre del serializador y no de las columnas.

## Validación
- `bunx jest src/modules/check-in src/modules/users`
- Caso: renombrar usuario ⇒ `GET /check-in/employees` devuelve el nombre nuevo.
- Caso: alta de usuario en tenant sin módulo Fichar ⇒ no crea ficha.

## Riesgos / rollback
- Dependencia circular Users↔CheckIn: resolver con import unidireccional (Users → CheckIn). Si aparece, mover `ensureForUser` a un listener de evento.
- Rollback: revertir el PR; no hay cambios de esquema ni de datos irreversibles.
