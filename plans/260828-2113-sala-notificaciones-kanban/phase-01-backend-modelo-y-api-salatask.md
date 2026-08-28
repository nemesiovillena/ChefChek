---
phase: 1
title: "Backend: modelo y API SalaTask"
status: completed
priority: P2
dependencies: []
---

# Phase 1: Backend: modelo y API SalaTask

## Overview

Nuevo modelo Prisma `SalaTask` + módulo NestJS `sala-tasks` con CRUD + reorder. Sigue los mismos patrones que `costing-config` (DTO simple) y `production` (reorder endpoint + `sortOrder`).

## Requirements

- Funcional: crear, listar (por tenant, excluyendo soft-deleted), obtener uno, editar, borrar (soft-delete), reordenar (drag entre columnas y dentro de columna).
- No funcional: multi-tenant scoping obligatorio (`tenantId` en cada query, igual que el resto del backend); `@Transform(numberAsString)` en `guestCount` para aceptar números que lleguen como string desde el frontend (bug ya conocido de `ValidationPipe`, ver `backend/src/modules/albaranes/dto/*.dto.ts` para el patrón exacto tras el fix reciente).

## Architecture

- Modelo Prisma nuevo `SalaTask` (ver tabla de campos en `plan.md`), con `@@index([tenantId, status, sortOrder])` para listar rápido por columna.
- Módulo nuevo `backend/src/modules/sala-tasks/` (controller, service, dto/) — **no** reutilizar `backend/src/modules/sala/` (dominio distinto: QR/feedback de clientes).
- Registrar `moduleId: 'sala-notificaciones'` en `backend/src/modules/modules/constants/registry.ts` (ver shape `ModuleDefinition` — `dependencies: []`, `alwaysActive: false`, `defaultEnabled: false` — confirmado por el usuario: activación manual por tenant desde superadmin).
- Guard `@RequireModule('sala-notificaciones')` en el controller, igual que otros módulos gateados (ver ejemplo en `backend/src/modules/albaranes/albaranes.controller.ts` o similar para la anotación exacta).

## Related Code Files

- Create: `backend/src/modules/sala-tasks/sala-tasks.module.ts`
- Create: `backend/src/modules/sala-tasks/sala-tasks.controller.ts`
- Create: `backend/src/modules/sala-tasks/sala-tasks.service.ts`
- Create: `backend/src/modules/sala-tasks/dto/sala-task.dto.ts` — desviación deliberada: los 3 DTOs planeados como archivos separados (create/update/reorder) se consolidaron en uno solo (~120 líneas) por YAGNI; no hay lógica compartida entre ellos que justifique separarlos.
- Modify: `backend/prisma/schema.prisma` (nuevo modelo `SalaTask`)
- Modify: `backend/src/modules/modules/constants/registry.ts` (nueva entrada)
- Modify: `backend/src/app.module.ts` (registrar `SalaTasksModule` — recordar añadirlo también a `exports` si aplica, ver memoria de bug "AppModule duplica controllers" sobre providers/exports)

## Implementation Steps

1. Añadir modelo `SalaTask` a `schema.prisma` con los campos de `plan.md`; generar migración (`prisma migrate dev` no es interactivo en este entorno — usar el workaround de `migrate diff` + `migration.sql` manual + `migrate deploy`, ver memoria del proyecto sobre esto).
2. Crear DTOs: `CreateSalaTaskDto` (title, eventDate, guestCount?, customerName?, customerPhone?, customerEmail?, menuNotes?, observations?, allergies?, status default PENDIENTE), `UpdateSalaTaskDto` (todos opcionales), `ReorderSalaTasksDto` (`{ id: string; status: string; sortOrder: number }[]`). Aplicar `@Transform(numberAsString)` en `guestCount` y `@Transform` de fecha en `eventDate` si hace falta coerción (verificar contra el fix reciente de DTOs de albaranes antes de reinventar el helper — reusar si ya es exportable). `customerEmail` con `@IsOptional() @IsEmail()`.
3. Implementar `SalaTasksService`: `create`, `findAll(tenantId)`, `findOne(id, tenantId)`, `update(id, tenantId, dto)`, `remove(id, tenantId)` (soft-delete vía `.update({ deletedAt })`, nunca `.delete()`), `reorder(tenantId, items)` (transacción con updates de `status`+`sortOrder` por id, validando que cada id pertenece al tenant).
4. Implementar `SalaTasksController` con las rutas REST bajo `/api/v1/sala-tasks`, `@RequireModule('sala-notificaciones')`, `@UseGuards(AuthGuard)` si el patrón del módulo lo exige (revisar un controller similar reciente para copiar el guard exacto).
5. Registrar el módulo nuevo en `AppModule` y la entrada en `MODULE_REGISTRY`.
6. Build (`bun run build` en `backend/`, el proceso no tiene watch — ver memoria "Backend :3001 dist no watch") y smoke-test manual de los endpoints con curl (login + header `X-Tenant-Slug`, ver memoria de auth API).

## Success Criteria

- [x] Migración aplicada sin romper el resto del schema — nota: `prisma migrate deploy` no se pudo usar tal cual (P3005: la BD local dev tiene 93 tablas creadas históricamente sin tracking de `_prisma_migrations`, problema preexistente y ajeno a esta feature). Se aplicó el SQL de la migración directamente vía `psql` (verificado 0 filas en `tenants`, sin riesgo de datos) y se dejó el archivo de migración versionado normalmente para que `migrate deploy` funcione en entornos con historial correcto.
- [x] DTOs aceptan `guestCount` numérico o string sin 400 — verificado por code-review (`@Type(() => Number)` + `ValidationPipe({transform:true})` global); no se hizo curl end-to-end (ver nota abajo).
- [x] `PATCH /reorder` persiste `status` + `sortOrder` correctamente para múltiples items en una sola llamada — cubierto por test unitario (transacción atómica).
- [x] Borrado es soft-delete (`deletedAt` seteado, fila sigue en BD) — cubierto por test unitario.
- [x] `bun run build` del backend sin errores de tipos.
- [ ] CRUD completo con curl autenticado (200/201/204) — **no verificado end-to-end**: la BD local (`localhost:5432`) está vacía (0 tenants) y el puerto 3001 ya estaba ocupado por otro proceso; verificado en su lugar vía 10 tests unitarios de servicio (incluye aislamiento por tenant) + code-review explícito del controller/guards. Pendiente de smoke-test real la primera vez que se despliegue a un entorno con datos.

## Risk Assessment

- **Migración no interactiva**: usar el workaround ya documentado (`migrate diff` + SQL manual) para evitar bloquear el flujo en este entorno.
- **Confusión de nombres `sala` vs `sala-tasks`**: mantener carpetas/módulos separados y no tocar `backend/src/modules/sala/*` en esta fase.
- **Gating de módulo mal configurado** podría dejar la card invisible para todos los tenants tras el deploy — confirmar `defaultEnabled` con el usuario antes de mergear (pregunta abierta #3 del plan).
