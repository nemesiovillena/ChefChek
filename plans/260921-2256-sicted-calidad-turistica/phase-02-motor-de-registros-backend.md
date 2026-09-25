---
phase: 2
title: "Motor de registros backend"
status: completed
priority: P1
effort: "L"
dependencies: [1]
---

# Phase 2: Motor de registros backend

## Overview

Plantillas (Plan) → hojas por periodo (Registro) → marcas append-only con doble validación. Un solo motor sirve limpieza, apertura, cierre, confort/baños, sostenibilidad y recepción cambiando `kind`.

**Revisado 2026-09-24 contra los documentos reales de Warynessy** (`/Users/nemesioj/Documents/Trabajos offline/ChefChek/artefactos/SICTED/` y `/APPCC/`, preparados originalmente por una consultora externa — ICSAM — con código de documento propio tipo `RE 2-1`, `RE 4-2`, `BP5.10.1`): el motor no es un único tipo de hoja, son **tres modos** sobre el mismo esqueleto Plantilla→Hoja→Marca:

| Modo | Qué es | Documento real que lo confirma |
|---|---|---|
| `EXECUTION` | "¿Se hizo?" — rejilla filas=elemento, columnas=Fecha+Trabajador repetidas. Sin firma de supervisor en el propio documento. | `limpieza cocina wary.docx`, `ALMACEN WARY.docx`, `ASEOS COCINA.docx`, `limpieza camaras.docx`, `BARRA WARY.docx`, `COMEDOR WARY.docx` |
| `INSPECTION` | "¿Está en buen estado?" — periódica (semanal/mensual en los ejemplos), columnas BIEN/MAL/OBSERVACIONES por elemento, **doble firma** "Elaborado por" + "Aprobado por" al pie de toda la hoja. | `Ficha-maestra-Revisión limpieza.doc` (cód. RE 2-1, limpieza semanal — **compartida**); `Ficha-maestra-Revisión mantenimiento, manipuladores y plagas.doc` (cód. RE 04-01, mensual — sus bloques "Control de manipuladores"/"Control de plagas" son **solo APPCC**, no entran en el catálogo SICTED) |
| `MEASUREMENT` | Un valor numérico por elemento (no sí/no) — fecha, hora, Tª cámara, Tª termómetro control, acción correctiva si procede, firma. | `Ficha-Comprobación Temperaturas.doc` (cód. RE 4-2 — **compartida**) |

Además, **la frecuencia va por ítem, no por toda la plantilla**: el "Plan de limpieza y desinfección" real mezcla, dentro de una misma zona (p.ej. ALMACÉN), ítems DIARIO, SEMANAL, MENSUAL y "DESPUÉS DE CADA USO". El usuario tiene además checklists específicos del propio Plan de limpieza pendientes de enviar — cuando lleguen, si contradicen el mapeo de frecuencia por ítem aquí asumido, se ajusta antes de implementar.

**Decisión 2026-09-24 — motor compartido con APPCC**: la mayoría de estos documentos (limpieza, temperatura, mantenimiento) son literalmente los mismos que usa el módulo APPCC en papel. El usuario pidió explícitamente no duplicar esa información entre los dos módulos de Chefchek, manteniendo cada uno activable por separado. Resolución: **el modelo de datos de este motor no vive en `sicted`, vive en un módulo NestJS neutro `checklists`** (ver fase 1) que `sicted` consume con su propio guard/rutas — y que un futuro plan de reconstrucción de `appcc` podrá consumir igual, sin tocar este motor. Ninguna tabla de este documento lleva prefijo `sicted_`; llevan `checklist_`.

## Requirements

- Funcional: CRUD de plantillas (ADMIN/OWNER) en cualquiera de los 3 modos; generación de hojas según la frecuencia de sus ítems; marcar ítems (USER+) — TASK: hecho/no hecho+motivo; CONDITION: bien/mal+observación obligatoria si mal; MEASUREMENT: valor+acción correctiva si fuera de rango; doble validación (Elaborado por/Aprobado por) solo donde el documento real la exige (`INSPECTION`, y `MEASUREMENT` si el tenant lo pide); corrección = nueva marca con motivo.
- No funcional: append-only real (trigger), aislamiento por tenant, periodos Europe/Madrid, idempotencia de la generación, ningún dato duplicado entre `sicted` y un futuro `appcc` que consuma el mismo motor.

## Architecture

Todas con `tenantId`. Sin soft-delete; las plantillas se **archivan** (`archivedAt`), nunca se borran. Viven en el módulo `checklists` (fase 1), no en `sicted`.

```
ChecklistTemplate      id, tenantId, name, externalCode? (p.ej. "RE 2-1", trazabilidad con el papel existente),
                       usedByModules String[] (subconjunto de "sicted"|"appcc" — qué módulo(s) ven/editan esta
                       plantilla; una plantilla de limpieza real lleva ambos, "Control de manipuladores" solo "appcc"),
                       kind(CLEANING|OPENING|CLOSING|COMFORT|SUSTAINABILITY|RECEPTION|MAINTENANCE|OTHER),
                       mode(EXECUTION|INSPECTION|MEASUREMENT), area (Sala|Cocina|Baños|Almacén y cámaras|Otro),
                       frequency(DAILY|WEEKLY|MONTHLY|QUARTERLY|ANNUAL) -- cadencia de la HOJA (ChecklistRun);
                       weekday?, dayOfMonth?, responsiblePosition? (texto: "Jefe de cocina"),
                       requiresSupervisor (default: true si mode=INSPECTION; false si mode=EXECUTION o
                       MEASUREMENT — ningún documento real de ejecución diaria ni de `Comprobación de
                       Temperaturas` lleva firma de supervisor, solo una firma por fila; configurable por tenant
                       — <!-- Updated: Validation Session 1 - MEASUREMENT explícitamente sin supervisor por defecto -->),
                       practiceRef? (código buena práctica SICTED, nullable — no aplica a plantillas solo-appcc),
                       version, archivedAt?, createdBy, createdAt, updatedAt
ChecklistTemplateItem  id, tenantId, templateId, position, label, itemFrequency? (DAILY|WEEKLY|MONTHLY|QUARTERLY|
                       ANNUAL|AFTER_EACH_USE|AS_NEEDED — null = hereda `frequency` del template; se usa cuando una
                       misma zona mezcla cadencias, como el Plan de limpieza real), procedure? (paso a paso,
                       contaminación cruzada), products String[], dosage?, epi?, isRequired,
                       expectedRangeMin?/expectedRangeMax? (solo mode=MEASUREMENT, p.ej. cámara -18 a -22ºC)
ChecklistRun           id, tenantId, templateId, periodKey ('2026-09-21' | '2026-W38' | '2026-09'), periodStart,
                       status(OPEN|COMPLETED|INCOMPLETE), snapshot Json (nombre+versión+ítems al crearse),
                       closedAt?, supervisedAt?, supervisedByUserId?, supervisorName?, supervisorNote?, createdAt
                       @@unique([templateId, periodKey])
ChecklistEntry         id, tenantId, runId, itemId,
                       -- TASK (mode EXECUTION): outcome(DONE|NOT_DONE), reason? (obligatorio si NOT_DONE)
                       -- CONDITION (mode INSPECTION): outcome(OK|BAD), observation? (obligatoria si BAD)
                       -- MEASUREMENT: value(Float), withinRange (calculado contra expectedRange), correctiveAction?
                       note?, correctsEntryId?, performedByUserId?, performedByName (snapshot),
                       sessionUserId (cuenta de login), recordedAt default now()  -- SOLO INSERT
```

Estado "vigente" de un ítem = última entrada por `(runId,itemId)`; el histórico completo se conserva y se muestra. Triggers: `ChecklistEntry` → `forbid_mutation` (genérica, fase 1); `ChecklistRun` → variante "sellada" (UPDATE permitido solo si `supervisedAt IS NULL`, y sin tocar `snapshot/templateId/periodKey`).

Generación de hojas: (a) `@Cron` 00:10 Europe/Madrid en `ChecklistsModule` — para cada tenant con **al menos uno** de los módulos en `usedByModules` de esa plantilla activo, crea las hojas del día (DAILY siempre; WEEKLY el `weekday`; MONTHLY el `dayOfMonth`) por `upsert` sobre el unique; (b) cierra hojas OPEN de periodos vencidos → `INCOMPLETE` y crea **una** `Alert` por cada módulo activo que la use (campana, idempotente por `entityType/entityId`); (c) *lazy*: `GET .../runs/today` también crea las que falten (cron caído, plantilla nueva a mitad de día). Patrón: `compras/services/stale-partial-order-alert.service.ts`.

## Related Code Files

- Create: `backend/prisma/schema.prisma` (modelos arriba), migración + triggers.
- Create: `backend/src/modules/checklists/{services,dto,util}/…`: `checklist-template.service.ts`, `checklist-run.service.ts`, `checklist-run-scheduler.service.ts`, `checklist-period.util.ts` (periodKey/rangos en Madrid; **una** implementación, testeada con reloj congelado como `3c535bf`), `checklist-starter-templates.constant.ts`. **Sin controlador propio** (ver fase 1: los controladores viven en cada módulo consumidor).
- Create: `backend/src/modules/sicted/sicted-checklist.controller.ts` (`@Controller("api/v1/sicted/checklists")`, `@RequireModule("sicted")`; delega en los servicios de `ChecklistsModule` filtrando siempre por plantillas cuyo `usedByModules` incluye `"sicted"`).
- Modify: `backend/src/modules/checklists/checklists.module.ts`, `backend/src/modules/sicted/sicted.module.ts` (importa `ChecklistsModule`).
- Reutilizar sin modificar: `users` (listado de personas activas del tenant para el selector), servicio de `Alert`.

## API (prefijo `api/v1/sicted/checklists`, servido por `SictedChecklistController` sobre el motor compartido)

| Ruta | Rol | Nota |
|---|---|---|
| `GET/POST/PATCH templates`, `POST templates/:id/archive`, `PUT templates/:id/items` | ADMIN/OWNER | PATCH sube `version`; ítems por reemplazo completo; crear desde `sicted` añade `"sicted"` a `usedByModules` (crea si no existe, añade el módulo si la plantilla ya existía) |
| `POST templates/starter` | ADMIN/OWNER | plantillas de ejemplo idempotentes (nunca seed) |
| `GET runs/today` | USER+ | crea faltantes, solo plantillas con `"sicted"` en `usedByModules` |
| `GET runs?from&to&templateId&status&area` | USER+ | paginado servidor; matriz mensual |
| `GET runs/:id` | USER+ | snapshot + todas las entradas |
| `POST runs/:id/entries` | USER+ | lote de marcas; `performedByUserId` validado contra el tenant; rechaza si hoja supervisada |
| `POST runs/:id/supervise` | ADMIN/OWNER | una vez; exige ítems obligatorios resueltos |
| `GET performers` | USER+ | personas para "quién lo hizo" |

Todas las rutas 404 si la plantilla/hoja pedida no incluye `"sicted"` en `usedByModules` (aunque exista para `"appcc"`) — así un futuro controlador `AppccChecklistController` puede coexistir sin fugas cruzadas de visibilidad, aunque el dato subyacente sea el mismo.

DTOs: `ValidationPipe` no coacciona número→string (usar `@Type`/`@IsNumber`). Fechas del cliente **ignoradas**: la hora la pone el servidor.

## Implementation Steps

1. Decisiones confirmadas aplicadas: supervisar = rol ADMIN/OWNER (sin campo nuevo); identidad = selector de persona **sin PIN** (`performedByUserId`/`performedByName` bastan, sin tabla de credenciales adicional).
2. Modelos + migración manual (`migrate diff`); adjuntar triggers de fase 1.
3. `checklist-period.util.ts` + tests (medianoche Madrid, cambio horario marzo/octubre, semana ISO, fin de mes).
4. Servicio de plantillas en `ChecklistsModule` (versionado, archivado, ítems, gestión de `usedByModules`).
5. Servicio de hojas: generación idempotente, snapshot, marcas, corrección, supervisión, cierre.
6. Scheduler + alertas (una por hoja vencida y módulo activo que la usa).
7. `SictedChecklistController` (guards, roles, DTOs, filtro por `usedByModules` incluye `"sicted"`).
8. Plantillas iniciales, con `usedByModules` correcto:
   - **Compartidas `["sicted","appcc"]`**: `limpieza cocina wary`, `ALMACEN WARY`, `ASEOS COCINA`, `limpieza camaras`, `BARRA WARY`, `COMEDOR WARY` (mode EXECUTION); `Ficha-maestra-Revisión limpieza` (mode INSPECTION); `Comprobación de Temperaturas` (mode MEASUREMENT) — ya recibidas y confirmadas.
   - **Solo `["appcc"]`, no se siembran desde `sicted`**: bloques "Control de manipuladores"/"Control de plagas" de `Ficha-maestra-Revisión mantenimiento, manipuladores y plagas`.
   - Más las del propio Plan de limpieza y desinfección, pendientes de llegar.
   - Si para alguna área SICTED no hay hoja real, plantilla de ejemplo `["sicted"]` con productos/dosis vacíos para que el tenant los rellene (el auditor pide productos aptos para industria alimentaria: no inventarlos). Mismo endpoint idempotente en todos los casos; conservar `externalCode` cuando el documento origen lo tenga.

## Tests (jest, no `bun test`)

- Unit: periodos, generación idempotente (2 ejecuciones → 1 hoja), lazy vs cron, cierre → INCOMPLETE + 1 alerta, corrección conserva histórico, vigente = última; marca `CONDITION=BAD` sin `observation` → rechazada; marca `MEASUREMENT` fuera de `expectedRange` → `withinRange=false` calculado, no de confianza del cliente.
- Integración con Postgres real (`chefchek_test`, guardia en `setup.ts`): UPDATE/DELETE de `ChecklistEntry` fallan; UPDATE de run tras supervisar falla; purge de tenant con escape funciona.
- **Filtro `usedByModules`**: plantilla con solo `["appcc"]` → 404 desde `SictedChecklistController`; plantilla con `["sicted","appcc"]` visible y editable desde `sicted` sin duplicar filas.
- Aislamiento: tenant B recibe 404 al pedir run/plantilla de A en cada endpoint.
- Autorización: USER no supervisa ni edita plantillas; VIEWER no marca.

## Success Criteria

- [x] Todo lo de la tabla API funciona y está cubierto por tests — `test/e2e/sicted-checklist-controller.e2e-spec.ts` (HTTP real, guards incl.) + `test/e2e/checklist-engine.e2e-spec.ts` (servicios).
- [x] Marcas imposibles de alterar vía API y vía SQL de aplicación — `test/e2e/checklist-entries-immutability.e2e-spec.ts` (tablas reales `checklist_entries`/`checklist_runs`).
- [x] Doble ejecución del cron no duplica hojas ni alertas — `checklist-engine.e2e-spec.ts` (`ensureRunsForToday` x2) + `closeElapsedRuns` solo devuelve runs que acaban de cerrar en el tick (no reinserta alerta en ticks siguientes).
- [x] Backup+restore de tenant con datos de `checklist_*` no da 42703 — `buildScopeClause` resuelve el scope por `information_schema.columns` (no por lista estática `CHILD_SCOPE_RULES`); las 4 tablas `checklist_*` tienen `tenantId` propio → rama directa, sin gap. Mecanismo de escape ya probado en fase 1 (`backup-restore-evidence-escape.e2e-spec.ts`) contra una tabla con el mismo prefijo/forma.
- [x] Una plantilla marcada como compartida es una sola fila en `ChecklistTemplate`, no dos — `checklist-engine.e2e-spec.ts` ("seedStarter con externalCode añade el módulo en vez de duplicar la fila").

## Risk Assessment

- *Cuenta compartida*: sin persona real la evidencia es débil → `performedByName` obligatorio (P3 resuelve UX).
- *Cron multi-tenant*: iterar solo tenants con algún módulo de `usedByModules` activo; un fallo en uno no aborta al resto (try/catch por tenant + log).
- *Plantilla editada con hoja abierta*: la hoja usa su snapshot; documentar que el cambio aplica desde la siguiente hoja.
- *Acoplamiento `sicted`↔`appcc` vía el motor compartido*: mitigado por vivir en un tercer módulo neutro (`checklists`) del que ambos dependen, en vez de que uno dependa directamente del otro; si `appcc` nunca llega a reescribirse, `checklists` queda simplemente como infraestructura interna de `sicted` sin coste añadido.
- *Crecimiento*: ~40 ítems × 365 días × varias plantillas ≈ decenas de miles de filas/año/tenant: índices `(tenantId, runId)` y `(tenantId, periodStart)`; sin problema.
- *Rollback*: migración aditiva; módulo off → inerte. Los datos de evidencia **no** se borran al desactivar el módulo.
