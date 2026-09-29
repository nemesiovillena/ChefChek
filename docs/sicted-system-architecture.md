# Arquitectura del Sistema SICTED

## Descripción General

SICTED (Sostenibilidad, Inteligencia y Calidad Turística en el Ecosistema del Destino) es el módulo de ChefChek que produce las **evidencias trazables** que exige el distintivo de calidad turística: registros digitales inalterables de limpieza, apertura/cierre, mantenimiento, proveedores, personas, cliente y dirección, más un motor de autoevaluación y un informe anual agregado. Regla de oro del evaluador SICTED que gobierna todo el diseño: **"lo que no está registrado, no se ha hecho"**.

SICTED **no concede el distintivo** — lo concede un evaluador humano en la plataforma oficial. ChefChek aporta evidencias trazables y las empaqueta para esa evaluación; toda pantalla de autoevaluación lo rotula explícitamente.

SICTED es **independiente de APPCC**: activación propia por tenant (`@RequireModule("sicted")`), tablas propias, sin tocar `backend/src/modules/appcc/`. El motor de registros diarios (limpieza, apertura/cierre, temperatura, mantenimiento) vive en un módulo neutro (`ChecklistsModule`) compartido entre `sicted` y `appcc`, filtrado por `usedByModules` — ninguno de los dos duplica plantillas ni datos del otro.

## Estructura de módulos

### Backend (NestJS)

```
backend/src/modules/sicted/
├── sicted.module.ts                       # registro de todos los controladores/providers
├── sicted.controller.ts                   # ping/estado del módulo
├── sicted-checklist.controller.ts         # hoy, registros, editor de plan (fase 2-3)
├── sicted-maintenance.controller.ts       # activos, planes, registros, incidencias (fase 4)
├── sicted-audit.controller.ts             # PDFs/CSV, cobertura (fase 5)
├── sicted-suppliers.controller.ts         # cumplimiento, incidencias, inventario (fase 6)
├── sicted-personas.controller.ts          # puestos, formación, protocolos (fase 7)
├── sicted-clientes.controller.ts          # quejas, satisfacción, objetos perdidos (fase 8)
├── sicted-direccion.controller.ts         # catálogo, autoevaluación, mejora, objetivos (fase 9)
├── sicted-direccion-legal.controller.ts   # eventos, documentos legales (fase 9)
├── sicted-direccion-report.controller.ts  # informe anual agregado (fase 9)
├── dto/                                   # un DTO por sub-dominio
├── services/                              # un servicio por sub-dominio
├── constants/sicted-practice-catalog-2026-seed.ts  # 336 BP SICTED 2026 (autogenerado)
└── constants/sicted-complementary-modules.ts      # grupos de módulos complementarios

backend/src/modules/checklists/            # motor compartido sicted+appcc
├── checklists.module.ts
├── services/
│   ├── checklist-template.service.ts      # plan (plantillas + ítems)
│   ├── checklist-run.service.ts           # hoja (registro por periodo)
│   ├── checklist-run-scheduler.service.ts # cron: genera hojas del día, avisos vencidas
│   ├── checklist-asset.service.ts         # equipos (fase 4)
│   ├── checklist-maintenance.service.ts   # planes/registros de mantenimiento
│   ├── checklist-maintenance-reminder.service.ts  # cron: avisos a 30 días/vencido
│   └── checklist-incident.service.ts      # averías + PAC (parte de acción correctiva)
└── util/checklist-period.util.ts, checklist-maintenance-date.util.ts
```

`SictedDireccionController`/`SictedDireccionLegalController`/`SictedDireccionReportController` comparten el mismo prefijo de ruta (`api/v1/sicted/direccion`) en tres archivos separados — regla de modularización del proyecto (~200 líneas/archivo), sin colisión de rutas porque cada uno registra sub-paths distintos.

### Frontend (Next.js)

```
frontend/src/app/dashboard/sicted/
├── page.tsx                    # hub con progreso de hoy, pendientes de validar, vencidas
├── hoy/page.tsx                # maestro-detalle de las hojas de hoy
├── registros/page.tsx          # matriz mensual (filas=ítems, columnas=periodos)
├── registros/[runId]/page.tsx  # detalle solo lectura de una hoja
├── plan/page.tsx                # editor de Plan (plantillas + ítems)
├── mantenimiento/page.tsx      # 3 pestañas: Calendario, Equipos, Averías
├── auditoria/page.tsx          # descargas PDF/CSV + panel de cobertura
├── proveedores/page.tsx        # 4 pestañas: Perfil, Incidencias, Inventario, Evidencia
├── personas/page.tsx           # 3 pestañas: Puestos, Formación, Protocolos
├── clientes/page.tsx           # 3 pestañas: Quejas, Satisfacción, Objetos perdidos
└── direccion/page.tsx          # 7 pestañas: Catálogo, Autoevaluación, Plan de mejora,
                                 #   Objetivos, Eventos, Legal, Informe anual
```

## Modelo de datos

### Motor compartido (`Checklist*`, tablas `checklist_*`)

| Modelo | Qué es |
|---|---|
| `ChecklistTemplate`/`ChecklistTemplateItem` | Plan (teoría): plantilla versionada + ítems con frecuencia/producto/responsable, `usedByModules: ('sicted'\|'appcc')[]` |
| `ChecklistRun`/`ChecklistEntry` | Registro (práctica): hoja por periodo con snapshot de la plantilla; marca append-only con corrección "nueva entrada con motivo", nunca edición |
| `ChecklistAsset` | Equipo/activo (fase 4) |
| `ChecklistMaintenancePlan`/`ChecklistMaintenanceRecord` | Calendario de revisiones + registros append-only |
| `ChecklistIncident` | Avería o PAC (parte de acción correctiva), hitos null→valor |

Tres modos de checklist según el documento real que digitalizan: `EXECUTION` (tarea hecha/no hecha), `INSPECTION` (BIEN/MAL + doble firma), `MEASUREMENT` (valor numérico, sin supervisor por defecto).

### SICTED propio, por bloque

| Bloque (fase) | Modelos | tabla(s) |
|---|---|---|
| Proveedores (6) | `SictedSupplierComplianceProfile`, `SictedSupplierIncident`, `SictedInventorySnapshot` | `sicted_supplier_*`, `sicted_inventory_snapshots` |
| Personas (7) | `SictedJobProfile`, `SictedJobAssignment`, `SictedTrainingPlan`, `SictedTrainingAction`, `SictedTrainingAttendance`, `SictedProtocol`, `SictedProtocolAck` | `sicted_job_*`, `sicted_training_*`, `sicted_protocol*` |
| Cliente (8) | `SictedFeedback`, `SictedSatisfactionSample`, `SictedLostItem` | `sicted_feedback`, `sicted_satisfaction_samples`, `sicted_lost_items` |
| Dirección — catálogo/autoevaluación (9.1) | `SictedPractice`, `SictedAssessment`, `SictedAssessmentScore` | `sicted_practices`, `sicted_assessments`, `sicted_assessment_scores` |
| Dirección — mejora/objetivos (9.2) | `SictedImprovementAction`, `SictedObjective` | `sicted_improvement_actions`, `sicted_objectives` |
| Dirección — eventos/legal (9.3) | `SictedEvent`, `SictedComplianceDoc` | `sicted_events`, `sicted_compliance_docs` |

El informe anual (9.4) no tiene tabla propia: agrega de solo lectura las anteriores.

Todas las tablas SICTED llevan `tenantId` propio (no reglas hijas de backup) y quedan **excluidas del soft-delete** (extensión Prisma de `PrismaService`) — evidencia no se "papelera".

## Catálogo de buenas prácticas

Metodología **SICTED 2026** (manual de metodología SEGITTUR rev. 1.1, ago-2026): distintivo *Compromiso de Turismo Responsable*; cada Manual de Buenas Prácticas se organiza en capítulo (intersectorial / oficio / complementario) × eje (sostenibilidad económica / social / ambiental) × módulo, y cada práctica es **obligatoria** o **de mejora**.

- **Fuente**: Biblioteca de sicted.es, guardada en `artefactos/SICTED/Manuales/2026/` — «Índice global de BBPP_20260618.xlsx» (qué prácticas aplican al oficio «Restaurantes y empresas de catering») + 6 PDF «BP oficios/intersectoriales Eje SOST.*» (descripción, documentación requerida, plantillas, relacionadas, ODS).
- **Seed autogenerado** por `scripts/sicted/extract_bbpp_2026.py` (openpyxl + pdfplumber; asigna celdas por posición relativa bajo cabeceras verticales y verifica contra el Excel): 258 de oficio (74 obligatorias) + 78 complementarias (38 obligatorias); 24 «esenciales» (entran en la evaluación parcial de seguimiento). Para regenerar tras una nueva versión del Índice: ejecutar el script y revisar `sinDescripcion`/`noEncontradasEnPdf` (deben salir vacíos).
- **Carga**: botón explícito «Cargar catálogo SICTED 2026» (idempotente, `skipDuplicates` por `(tenantId, code)`); las prácticas de catálogos anteriores se **archivan** (`archivedAt`), nunca se borran, y sus autoevaluaciones conservan el historial.
- **Módulos complementarios**: `SictedSettings.enabledComplementaryModules` (moduleCodes), editable en Configuración → SICTED por grupos de condición de la «Guía para la configuración de los MBP» (`constants/sicted-complementary-modules.ts`; un test garantiza que cada módulo complementario del seed está en exactamente un grupo). Solo las complementarias activadas entran en la autoevaluación (`SictedPracticeCatalogService.listApplicable`).
- **Autoevaluación**: `SictedAssessmentScore.result` = `CUMPLE` | `NO_CUMPLE`, con «No aplica» como casilla aparte. La metodología 2026 no fija escala numérica; `score` 1-5 queda solo en autoevaluaciones del catálogo anterior. Pendientes = obligatorias aplicables sin «Cumple».
- **Enlaces a evidencia** (solo navegación, no marcan cumplimiento): `PRACTICE_EVIDENCE_LINKS` en `frontend/src/lib/sicted-practice-presentation.ts` (~70 prácticas). Las pantallas SICTED con pestañas guardan la pestaña en `?tab=` (`hooks/use-tab-query-param.ts`, página envuelta en `Suspense`) y el Plan acepta `?buscar=` para abrir filtrado (p. ej. 0413 → plantillas «aseos»).
- **Guía de uso** para el usuario: `/dashboard/sicted/ayuda` (enlazada desde la portada SICTED).

> Nota histórica: el catálogo de fase 9 (144 prácticas BP1-BP6, escala 1-5) venía de `23_Restaurantes_y_empresas_de_catering_v4.pdf`, de **2015**. Queda sustituido por el modelo 2026.

## Editar el Plan con hojas ya generadas

`ChecklistTemplateService.update` actualiza los ítems **en su sitio** (por `id`, que el editor envía): conserva la identidad de los que siguen, crea los nuevos y los quitados se borran solo si nunca se marcaron; si tienen marcas se **retiran** (`ChecklistTemplateItem.removedAt`) porque la FK de `checklist_entries` es `onDelete: Cascade` y el trigger de inalterabilidad bloquearía el borrado. Todo `include` que represente el Plan vigente usa `ACTIVE_CHECKLIST_ITEMS` (`removedAt: null`); el PDF de registros lee todos (histórico). Las hojas `OPEN`, sin marcas y sin validar renuevan su foto (`buildChecklistRunSnapshot`) al guardar el Plan; las ya trabajadas conservan la suya. Antes se borraban y recreaban todos los ítems: la hoja del día quedaba apuntando a ítems inexistentes (FK `checklist_entries_itemId_fkey` → 500 al marcar) y editar un Plan con marcas fallaba.

Valor habitual (`ChecklistTemplateItem.defaultValue`, solo MEASUREMENT): prerrellena la medición en «Hojas de hoy»; se lee de la plantilla vigente, no de la foto.

## Compromisos por fase del ciclo

Espejo del «visor de cumplimiento» de la web SICTED (sin integración: se calcula con lo registrado en Chefchek). Fase y comité en `SictedSettings` (`cyclePhase`, `phaseStartedAt`, `nextCommitteeDate`), editables en Configuración → SICTED.

- Reglas y mínimos en `constants/sicted-cycle-commitments.ts` (fuente: manual «Programa SICTED» rev. 1.1 §7-8); evaluación pura en `util/sicted-commitments-evaluator.ts` (spec por fase); lectura de BD en `SictedCommitmentsService` (`GET /sicted/direccion/commitments`).
- Ventanas: la fase va de `phaseStartedAt` (o 12 meses antes del comité) al comité (o hoy); formación = horas de acciones hechas en los 12 meses previos al comité; evaluación externa = evento en los 6 meses previos.
- Estados: DONE / IN_PROGRESS / PENDING / MANUAL (solo verificable en la web oficial: protocolo, manual de marca, curso básico del Campus) / NOT_APPLICABLE.
- `SictedEvent.kind` admite `ATI` y `ATC`; `SictedImprovementAction.attachment` guarda la evidencia de cada acción (`POST/GET improvement-actions/:id/evidence`, adjunto privado).

## Inalterabilidad

Las evidencias son append-only por diseño de producto, reforzado en Postgres con triggers (no solo en la capa de aplicación — un DBA siempre puede saltárselo; el objetivo es que ni la app ni un descuido lo hagan, y que quede rastro). Tres funciones genéricas, reutilizadas en todas las fases:

- **`forbid_mutation()`**: bloquea todo `UPDATE`/`DELETE` sobre la tabla. Usada en tablas de evidencia pura sin ningún campo corregible después (`checklist_entries`, `sicted_satisfaction_samples`, `sicted_training_attendances`, `sicted_events`...).
- **`forbid_milestone_rewrite(columna...)`**: bloquea reescribir una columna que ya tiene valor no-null (`IS DISTINCT FROM`, así que "actualizar al mismo valor" no cuenta como reescritura). Usada para hitos como `respondedAt`/`closedAt`/`resolvedAt`/`returnedAt` en entidades que sí son editables en el resto de sus campos (`SictedFeedback`, `SictedLostItem`, `SictedSupplierIncident.resolution`, `SictedImprovementAction.closedAt`, `SictedAssessment.closedAt`).
- **`forbid_score_update_if_assessment_closed()`** (única función no genérica, fase 9): la inmutabilidad de `sicted_assessment_scores` no depende de sus propias columnas sino del estado de la tabla padre (`sicted_assessments.status = 'CLOSED'`) — caso no cubierto por las dos funciones anteriores. Se dispara en `INSERT OR UPDATE OR DELETE`.

**Escape controlado**: `SET LOCAL chefchek.allow_evidence_purge = 'on'` dentro de una transacción deja pasar la operación (usado solo para limpieza de datos de prueba desechables en tests e2e, y en el flujo de restore de backup cuando se pide explícitamente incluir tablas de evidencia).

Entidades **editables, sin trigger** (no son evidencia de un evento puntual, son "planes vivos" que se corrigen mientras se trabajan): `SictedPractice`, `SictedObjective`, `SictedJobProfile`, `SictedTrainingPlan`/`SictedTrainingAction`, `SictedComplianceDoc`, `SictedImprovementAction` (salvo su hito `closedAt`).

## Cron jobs

| Servicio | Cuándo | Qué hace |
|---|---|---|
| `ChecklistRunSchedulerService` | diario | genera las hojas del día por plantilla activa; avisa de hojas vencidas sin completar |
| `ChecklistMaintenanceReminderService` | 08:00 | avisa a 30 días y al vencer una revisión de mantenimiento; idempotente vía `dueSoonAlertedAt`/`overdueAlertedAt` |
| `SictedComplianceReminderService` | 08:00 | avisa a 30 días y al vencer un documento legal; idempotente vía `dueSoonAlertedAt`/`expiredAlertedAt`, reseteado al renovar el documento |

Los tres comprueban que el módulo consumidor siga activo para el tenant antes de generar una alerta (`ModulesService.isModuleEnabled`) — desactivar `sicted` no debe seguir generando campanas.

## Roles y guards

Stack de guards idéntico en todos los controladores SICTED: `AuthGuard, TenantGuard, RolesGuard, ModuleGuard, SectionAccessGuard`, con `@RequireModule("sicted")` y `@RequireSection("sicted")` a nivel de clase. Lectura general con `@Roles("USER")`; escritura/gestión con `@Roles("ADMIN", "OWNER")` (la jerarquía de `RolesGuard` deja pasar por encima a `SUPERADMIN`).

## Exportables

PDFKit (mismo patrón en todas las fases: `doc.on("data", ...)`, `Buffer.concat(chunks)`, descarga autenticada vía blob):

- Plan por área, cuadrante mensual con huella SHA-256, calendario + libro de averías anual (fase 5).
- Informe anual de calidad (fase 9): agrega objetivos, plan de mejora, eventos, documentos legales vigentes, incidencias de proveedores, formación, quejas/satisfacción y la última autoevaluación cerrada del año — sin tabla propia, solo lectura.
- CSV de marcas (fase 5).

Descarga desde el navegador: `window.open('', '_blank')` **síncrono** dentro del gesto de clic, seguido de una petición `blob` autenticada que rellena `win.location.href` — iOS Safari bloquea en silencio cualquier apertura posterior a un `await`, así que el orden importa.

## Adjuntos privados

Certificados de formación, actas de eventos, documentos legales escaneados: `storePrivateAttachment`/`readPrivateAttachment` (zona Bunny sin Pull Zone si está configurada, o disco local fuera de `uploads/` en dev — nunca en la carpeta que `main.ts` sirve como estático sin auth). Se leen solo a través de un endpoint de descarga autenticado, nunca por URL directa.

## Backup y restore

`checklist_*` y `sicted_*` quedan **excluidas del restore por defecto** (`backup.constants.ts`); incluirlas exige el flag explícito `includeEvidenceTables`, que también activa el escape del trigger dentro de la misma transacción del restore.

## Límites conocidos (documentados, no implementados)

- **Motor de cobertura automática** (marcar prácticas como cumplidas a partir de registros): no se construye; en su lugar hay enlaces de solo navegación desde la práctica a la evidencia en Chefchek.
- **Autoevaluación/plan de mejora en el pack de auditoría de fase 5**: el informe anual de fase 9 cubre esa necesidad de otra forma (agregado propio), no se añadió a los PDFs existentes de fase 5.
- **Sin integración con la plataforma oficial SICTED**: la autoevaluación de este módulo es una herramienta de apoyo interno; la evaluación real la hace un evaluador externo humano en `calidadendestino.org` o equivalente. Todas las pantallas de autoevaluación lo rotulan explícitamente.
