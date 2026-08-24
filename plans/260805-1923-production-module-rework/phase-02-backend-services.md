# Fase 2: DTOs, servicio y controlador contra el schema real

## Status (2026-08-05)
**Completada.** Decisiones tomadas durante la ejecución (difieren del plan original en detalle, no en intención):
- `CreateWorkBatchDto` perdió el campo `name`: `batchNumber` se autogenera (`LOTE-0001`) vía `WorkBatchNumberService`, y la descripción libre del formulario se guarda en `notes`. No hizo falta columna nueva.
- `CreateTaskAssignmentDto` se simplificó a `{ orderId, taskId, assignedTo }` — crear la tarea (`POST tasks`, `CreateProductionTaskDto`) y asignarla a alguien son dos pasos separados, no uno.
- CRUD de `StaffMember` (`CreateStaffMemberDto`/`UpdateStaffMemberDto`, endpoints `POST/PUT staff`) se adelantó a esta fase (estaba asignado a fase 4) para no dejar el módulo a medias.
- **Hallazgo nuevo no previsto en el plan**: `Product` no tiene columnas propias `stock`/`reservedStock` — el stock real vive en el modelo `Stock` (por almacén), gestionado por `WarehousesService` (módulo Almacenes). `reserveIngredient`/`updateInventory` se reescribieron para usar `WarehousesService.reserveStock()` (reutilizado, no reinventado) y `prisma.stock` directamente para el consumo al completar — el código original de este stub intentaba escribir en columnas de `Product` que nunca existieron.
- Bugs adicionales corregidos sobre la marcha (todos eran fallos reales, no cambios de alcance): división por cero en `generateFinalReport`/KPIs si un lote no tiene órdenes; `TaskAssignment` no tenía columna `startedAt` (se quitó la escritura fantasma); `collectProductionData` usaba `createdAt` en `TaskAssignment` (no existe, es `assignedAt`).
- Progreso: mover la creación de `ProgressTracking`/`Milestone` de "al iniciar el lote completo" a "al iniciar cada orden individual" — más simple y consistente con que lotes/órdenes ahora se inician independientemente desde la UI (fase 3).
- Verificación: `npx tsc --noEmit` limpio, specs del módulo reescritos (63 tests, todos en verde), suite completa del backend en verde salvo 1 fallo preexistente en `albaranes.controller.spec.ts` sin relación con este trabajo (confirmado con `git diff --stat` — cero cambios en ese módulo).
- **Pendiente**: nada de este backend se ha probado en navegador todavía (fase 3+). Sigue sin aplicarse la migración de fase 1 en producción.

## Contexto
- Servicio actual: `backend/src/modules/production/production.service.ts` (928 líneas, casi todo con `(this.prisma as any)` porque el client generado no coincidía con lo que el código esperaba).
- Controlador: `backend/src/modules/production/production.controller.ts` — rutas y roles ya razonables, mantener casi igual, solo ajustar tipos/payloads.
- DTOs: `backend/src/modules/production/dto/production.dto.ts`.
- Patrón de numeración secuencial por tenant a replicar (soft-delete-safe, `$queryRaw` + `MAX` sobre TODAS las filas incluidas borradas, no `findFirst`): `backend/src/modules/compras/services/purchase-order-number.service.ts`. Crear equivalentes `WorkBatchNumberService` (`LOTE-0001`) y `ProductionOrderNumberService` (`PO-0001`) — sustituye el `orderNumber: \`PO-${Date.now()}\`` actual (colisiona en tests/alta concurrencia, no es realmente secuencial).
- Dependencia de fase 1: todos los cambios de aquí asumen el schema ya migrado.

## Requisitos por área

### Work Batches
- `CreateWorkBatchDto`: añadir `@Type(() => Date)` sobre `scheduledDate` (class-transformer) — sin esto, `@IsDate()` falla siempre que el body venga como JSON (string), que es el caso real del frontend. Este es el bug de validación 400 que reportó el usuario.
- `createWorkBatch`: usar `WorkBatchNumberService.generateBatchNumber(tenantId)` en vez de `dto.name` para `batchNumber`; usar `dto.name` como campo separado si se añade `name` al schema — **decisión**: reutilizar `notes`/no añadir campo `name` nuevo; en su lugar, `batchNumber` es el número de secuencia (`LOTE-0001`) y el "nombre" que el usuario escribe se guarda en `notes` o se añade `name String?` al schema de fase 1 si el frontend necesita mostrar un nombre libre además del número — **confirmar con el usuario en ejecución de esta fase si el campo `name` del formulario actual debe sobrevivir como texto libre independiente del número de secuencia** (afecta si hace falta un `ALTER TABLE` adicional no cubierto en fase 1).
- Persistir `priority`, `responsible`, `kitchenZone`, `scheduledFor` (combinando `scheduledDate`+`scheduledTime` con cuidado de zona horaria — usar `date-fns`/`Temporal` si ya está en uso en el repo, si no, construir con componentes explícitos, no interpolación de string de `Date.toString()`).
- `getWorkBatches`/`getWorkBatchById`: `orderBy: { scheduledFor: "desc" }` (no `scheduledDate`), `include: { productionOrders: true }` (ahora sí existe la relación), y filtrar `deletedAt: null`.
- `startWorkBatch`/`completeWorkBatch`: sin cambios de lógica, solo tipos correctos post-migración (quitar todos los `as any` que ya no hacen falta).

### Production Orders
- `CreateProductionOrderDto`: ya tiene los campos correctos (`batchId`, `recipeId`, `recipeName`, `quantity`, `unit`, `estimatedTime`, `ingredients`); el bug era solo que el servicio los descartaba.
- `createProductionOrder`: persistir TODOS los campos del DTO en el `create()`, usar `ProductionOrderNumberService` para `orderNumber`, `createdBy` = `req.user.id` real (hoy hardcodeado a `"system"` — pasar `userId` desde el controlador, que ya tiene `@Req()`).
- Al crear, también crear las `ProductionTask` derivadas si el DTO las incluye (o dejar creación de tareas como paso separado vía `POST assignments` existente — **decisión más simple (KISS): las tareas se crean explícitamente después, vía `createTaskAssignment`, no automáticamente al crear la orden** — evita inventar reglas de descomposición automática de receta→tareas que no están especificadas).
- `getProductionOrdersByBatch`: `where: { batchId, batch: { tenantId }, deletedAt: null }` — ahora válido con la relación real.
- Reserva de ingredientes (`reserveIngredient`) y actualización de inventario (`updateInventory`) — revisar que `Product.reservedStock`/`stock` existen (ya usados en otros módulos, memoria [[articulos-precio-real-peso-bruto-neto]] confirma que el modelo `Product` es real); sin cambios de lógica aquí, solo quitar `as any` innecesarios.

### Production Tasks + Task Assignments
- Nuevo DTO `CreateProductionTaskDto` (title, taskType, estimatedTime, dependencies?) y endpoint `POST production/tasks` (falta hoy — no hay forma de crear una `ProductionTask` antes de asignarla a alguien).
- `createTaskAssignment`: `taskId` ahora referencia `ProductionTask` (no `Task`); guardar `orderId` denormalizado; el resto de la lógica (chequeo de capacidad del staff) se mantiene igual.
- `updateTaskAssignment`: persistir `actualTime` (ya lo intenta, ahora el campo existe en schema).

### Mise en Place
- `createMiseEnPlaceSheet`/`addMiseEnPlaceItem`: sin cambios de lógica, solo relaciones reales.
- **Fix de seguridad**: `updateMiseEnPlaceItem` y `verifyMiseEnPlaceSheet` deben filtrar por `tenantId` en el `where` (hoy `updateMiseEnPlaceItem` solo filtra por `id`, IDOR entre tenants). Patrón: `findFirst({ where: { id, tenantId } })` antes del `update`, igual que ya hacen `startWorkBatch`/`startProductionOrder`.

### Progress Tracking, Milestones, Alerts
- Reescribir `getProgressTracking` para consultar desde `ProductionOrder` (el hub, ver decisión de arquitectura en `plan.md`): `productionOrder.findFirst({ where: { id: orderId, batch: { tenantId } }, include: { progressTracking: true, milestones: true, alerts: { where: { isResolved: false } } } })`.
- `checkForDelays`/`createMilestonesBatch`/`initializeProgressTrackingBatch`: adaptar a los nuevos nombres de campo (`isResolved` en vez de filtrar por `resolvedAt: null` al crear, `alertType` en vez de `type`).
- `resolveAlert`: setear `isResolved: true` **y** `resolvedAt`/`resolvedBy`/`resolution` (hoy solo pone `resolvedAt`/`resolvedBy`/`resolution`, sin `isResolved`, por lo que `getActiveAlerts` con filtro `resolvedAt: null` seguiría "funcionando" pero de forma inconsistente con el resto del schema — unificar en un solo criterio, usar `isResolved` en ambos sitios).

### Reports
- `generateFinalReport`/`generateProductionReport`: ahora `this.prisma.productionReport.create(...)` sin `?.` (modelo real de fase 1); quitar el optional chaining defensivo.
- `collectProductionData`: revisar el `where` compartido entre `workBatch`/`productionOrder`/`taskAssignment`/`productionAlert` — cada modelo tiene su propia forma de llegar a `tenantId` (directo en `productionAlert`/`productionTask` tras fase 1, vía `batch` en `productionOrder`), no reutilizar el mismo objeto `where` sin adaptar la clave de tenant por modelo (bug latente en el código actual que asume la misma forma para los 4).

## Archivos a modificar
- `backend/src/modules/production/dto/production.dto.ts`
- `backend/src/modules/production/production.service.ts`
- `backend/src/modules/production/production.controller.ts`
- Nuevos: `backend/src/modules/production/services/work-batch-number.service.ts`, `backend/src/modules/production/services/production-order-number.service.ts`
- `backend/src/modules/production/production.module.ts` (registrar los nuevos servicios como providers)

## Tests
Actualizar/crear specs en `backend/src/modules/production/production.service.spec.ts` y `production.controller.spec.ts` (ya existen, revisar qué asumen del schema viejo). Casos nuevos mínimos:
- Crear lote con body real del frontend (post fase 3) → 201, todos los campos persistidos.
- Crear orden de producción con `batchId` de un lote de OTRO tenant → 404 (no debe filtrar cross-tenant).
- `updateMiseEnPlaceItem` con item de otro tenant → 404 (regression test del fix IDOR).
- Generación de `batchNumber`/`orderNumber` no colisiona tras soft-delete (mismo caso que `purchase-order-number.service.spec.ts` si existe, replicar patrón).

Ejecutar con `bun run test` acotado al módulo `production` (no `bun test`, ver [[backend-tests-use-jest-not-bun-test]]).

## Riesgos / rollback
- Riesgo: quitar los `as any` puede destapar errores de tipos que hoy están silenciados — esperado y deseado, hay que resolverlos, no volver a envolver en `as any`.
- Rollback: fase aislada en código (servicio/DTO/controlador), revertir commit basta; no vuelve a tocar schema.
