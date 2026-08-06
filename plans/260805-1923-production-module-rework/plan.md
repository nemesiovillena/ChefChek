---
title: "Reconstrucción completa del módulo de Producción (Lotes/Órdenes de Trabajo)"
description: "El módulo 'production' está activo por defecto para todos los tenants pero es un stub inacabado: schema, DTOs, servicio y frontend no coinciden entre sí. Se rehace de extremo a extremo."
status: not-started
priority: P1
branch: main
tags: [production, prisma-migration, backend, frontend]
created: 2026-08-05
---

# Plan: reconstrucción del módulo de Producción

## Status
**Fases 1-6 completadas en dev (2026-08-06).** Flujo completo verificado en navegador real (no solo tests unitarios): crear lote → crear orden → mise en place → tareas/personal → alerta de retraso (campana general) → reporte de KPIs. Suite backend completa: 1610/1611 en verde (el único fallo es de `albaranes`, ajeno a este plan, sesión distinta trabajándolo — no tocado, confirmado con el usuario). 83 tests propios del módulo `production`, todos en verde.

**Único punto pendiente de todo el plan: aplicar la migración de fase 1 en producción** (backup previo obligatorio, nunca hecho — solo se migró en dev). El resto del plan (fases 2-6) es código de aplicación, no toca la BD de producción directamente. Requiere confirmación explícita del usuario antes de ejecutar `prisma migrate deploy` contra producción.

**Nota (260806):** al correr la suite completa del backend se detectó `backend/src/modules/albaranes/albaranes.service.spec.ts` roto (`Property 'mergeOcrDocuments' does not exist on type 'AlbaranesService'`) — cambios sin commitear ajenos a este plan (`git diff` muestra `albaranes.service.ts` modificado, más un directorio de plan sin trackear `plans/260806-1814-albaran-multi-file-ocr-merge/`), parece trabajo en curso de otra sesión. No se tocó — fuera de alcance de este plan. Los 81 tests del módulo `production` pasan en verde de forma aislada.

**Cambio de configuración en dev**: los módulos `production` y `almacenes` estaban desactivados (`Configuration` con `value=false`) para el tenant de pruebas `chefchek-demo` — se reactivaron manualmente vía SQL para poder probar (`almacenes` es dependencia real de `production`, no un efecto secundario). Si esto no era intencional, revisar en Superadmin → Tenants → Módulos.

## Contexto

El usuario reportó un error al intentar crear una "orden de trabajo". Investigando se encontró que el módulo `production` (activo por defecto para todos los tenants, `defaultEnabled: true` en `backend/src/modules/modules/constants/registry.ts:85-92`) nunca se terminó de cablear:

- `ProductionService.getWorkBatches`/`getWorkBatchById` ordenan/incluyen campos y relaciones que no existen en el modelo Prisma `WorkBatch` (`scheduledDate` en vez de `scheduledFor`, relación `productionOrders` inexistente) → el listado ya rompe al cargar la página, antes de crear nada.
- El modelo `ProductionOrder` no tiene columna/relación `batchId` con `WorkBatch`, pero DTO y servicio lo asumen.
- `createProductionOrder` no persiste `batchId`, `recipeId`, `recipeName`, `quantity`, `unit`, `estimatedTime` — los lee del DTO y los descarta.
- El frontend (`use-production.ts` + `dashboard/production/page.tsx`) solo tiene formulario para crear **Lotes**, no Órdenes de Trabajo (esa pestaña es de solo lectura), y el formulario de Lotes envía campos (`plannedDate`) que no coinciden con el DTO real (`scheduledDate`+`scheduledTime`+`priority`+`responsible[]`+`kitchenZone`).
- `TaskAssignment.taskId` apunta al modelo `Task` genérico de gestión de proyectos (sprints, `dueDate`, `tags`) — mezcla de dominios sin sentido; `Task`/`Sprint` son exclusivos del módulo `sprint` (gestión de proyectos internos), no deben compartirse con producción de cocina.
- `ProgressTracking` está modelado por lote (`workBatchId`) pero el código lo usa por orden (`orderId`); no existen los modelos `Milestone` ni `ProductionReport` que el servicio referencia (protegidos con `?.` para no petar).
- `ProductionAlert` no tiene `orderId`, y el servicio usa nombres de campo (`type`, `resolution`) que no existen en el modelo (`alertType`, sin `resolution`).
- `updateMiseEnPlaceItem` no filtra por `tenantId` — permite que un tenant modifique el item de mise en place de otro tenant conociendo el id (IDOR). Se corrige en este plan.

El usuario eligió la opción **"Completo: todo el módulo"** — no solo Lotes+Órdenes, sino también mise en place, asignación de personal a tareas, alertas de retraso y el reporte de KPIs, todos con su UI real.

Referencia de contexto ampliado: memoria [`production-work-order-module-broken-stub`](../../../../.claude/projects/-Users-nemesioj-Documents-Trabajos-offline-ChefChek-chefchek/memory/production-work-order-module-broken-stub.md) (nota: ruta fuera del repo, es la memoria persistente de la sesión).

## Decisiones de arquitectura (ya tomadas, no reabrir sin nueva evidencia)

1. **`ProductionOrder` es el hub del dominio.** `WorkBatch 1—N ProductionOrder`, y de `ProductionOrder` cuelgan `1—N ProductionTask`, `1—1 ProgressTracking`, `1—N Milestone`, `1—N ProductionAlert`, `1—N MiseEnPlaceItem`. Esto simplifica las queries del servicio: en vez de relaciones cruzadas raras (p.ej. `ProgressTracking` con relación directa a `Milestone`/`Alert`), se consulta siempre desde `ProductionOrder.findFirst({ include: {...} })`.
2. **`ProductionTask` es un modelo nuevo**, no se reutiliza `Task` (ese es del módulo `sprint`, dominio de gestión de proyectos, confirmado sin otros usos cruzados — ver fase 1).
3. **Soft-delete en `WorkBatch` y `ProductionOrder`** (`deletedAt DateTime?`), consistente con el resto de la app y con la regla de "cero pérdida de datos" del usuario. Los endpoints de borrado (si se añaden) actualizan `deletedAt`, nunca `prisma.delete()`.
4. **`batchNumber`/`orderNumber` con secuencia real vía `$queryRaw MAX(...)`**, no `findFirst`/contador en memoria (memoria [[soft-delete-breaks-sequence-generators]] — mismo problema aplicaría aquí una vez haya soft-delete).
5. **Multi-tenant scoping estricto**: toda query de lectura/escritura por id debe incluir `tenantId` (directo o vía relación), corrigiendo el IDOR de `updateMiseEnPlaceItem`.

## Fases

1. [phase-01-schema-migration.md](phase-01-schema-migration.md) — rediseño Prisma (WorkBatch, ProductionOrder, ProductionTask nuevo, TaskAssignment, MiseEnPlaceSheet/Item, ProductionAlert, Milestone nuevo, ProgressTracking, ProductionReport nuevo) + migración.
2. [phase-02-backend-services.md](phase-02-backend-services.md) — DTOs, `production.service.ts`, `production.controller.ts` reescritos contra el schema real; fix IDOR; secuencias; scoping tenant.
3. [phase-03-frontend-batches-orders.md](phase-03-frontend-batches-orders.md) — UI real de Lotes (crear/listar/iniciar/completar) y Órdenes de Producción (crear ligada a lote+receta+ingredientes, listar, iniciar/completar).
4. [phase-04-frontend-mise-en-place-staff.md](phase-04-frontend-mise-en-place-staff.md) — UI de checklist de mise en place por orden y de asignación de personal a tareas.
5. [phase-05-frontend-alerts-reports.md](phase-05-frontend-alerts-reports.md) — UI de alertas activas (resolución) y de reporte/KPIs de producción.
6. [phase-06-tests-validation.md](phase-06-tests-validation.md) — specs backend (jest, no `bun test` — ver [[backend-tests-use-jest-not-bun-test]]) + verificación manual en navegador del flujo completo.

## Dependencias
Secuencial: fase 1 → fase 2 → (fase 3, 4, 5 pueden hacerse en cualquier orden entre sí, todas dependen de fase 2) → fase 6 al final (o incremental tras cada fase de frontend).

## Riesgo principal

**La aplicación ya está en producción con datos reales de tenants.** El módulo `production` en sí es nuevo/nunca funcional (confirmado por el usuario 2026-08-05), así que sus propias tablas (`work_batches`, `production_orders`, `production_alerts`, `mise_en_place_*`) casi con certeza están vacías o con solo basura de pruebas — pero la migración de fase 1 corre `ALTER TABLE` contra la MISMA base de datos que tiene el resto de tenants reales (artículos, recetas, albaranes, pedidos...). Regla no negociable del usuario ([[zero-data-loss-mandatory-rule]]): **ningún cambio/migración puede perder datos**, aplica a toda la BD, no solo a las tablas de este módulo.

Por eso, antes de ejecutar la migración en fase 1:
1. **Backup completo de la BD de producción** (o snapshot/dump) antes de aplicar nada — no negociable, sin excepción, aunque el módulo en sí no tenga datos.
2. Verificar con `SELECT COUNT(*)` en `work_batches`/`production_orders`/`production_alerts`/`mise_en_place_sheets`/`mise_en_place_items` que efectivamente están vacías o solo con datos de prueba desechables — no asumir, comprobar.
3. Probar la migración primero en dev/staging (memoria [[two-postgres-databases-dev]] — confirmar cuál Postgres local usa el backend en :3001 antes de nada) y solo después replicarla en producción.
4. Preferir cambios aditivos (`ADD COLUMN` con `@default(...)`) sobre destructivos; cualquier `DROP COLUMN` (p.ej. el `miseEnPlaceItems Json?` duplicado de fase 1) requiere confirmación explícita del usuario en el momento de ejecutar, con el conteo de filas afectadas mostrado antes de aplicar.
5. Aplicar la migración en producción en ventana de bajo tráfico, con el backup del punto 1 ya verificado como restaurable.

## Criterios de aceptación (global)

- Cargar `/dashboard/production` no lanza error de Prisma (el GET de lotes funciona).
- Se puede crear un Lote desde la UI con todos sus campos reales (nombre, descripción, fecha+hora, prioridad, responsables, zona de cocina) y aparece en el listado.
- Se puede crear una Orden de Producción real desde la UI, ligada a un lote y una receta, con ingredientes — y persiste correctamente (`batchId`, `recipeId`, `quantity`, `estimatedTime` todos guardados).
- Se puede marcar mise en place, asignar personal a una tarea, ver alertas activas y resolverlas, y generar el reporte de KPIs — todo desde la UI, no solo desde Swagger/curl.
- Ningún endpoint permite leer/modificar datos de otro tenant por id (scoping tenant verificado en cada query).
- Tests backend del módulo pasan (`bun run test` acotado a `production`).

## Preguntas sin resolver
- ~~¿Hay datos reales en `work_batches`/`production_orders`?~~ Resuelto (260805): módulo nuevo, sin uso real — pero se verifica con `SELECT COUNT(*)` igualmente antes de migrar (paso 2 de la sección "Riesgo principal"), y el backup previo aplica de todas formas por ser BD de producción compartida.
- ¿"Responsables" del lote (`responsible`) son ids de `StaffMember`, ids de `User` (usuarios de la app), o texto libre? No hay precedente en el código actual.
