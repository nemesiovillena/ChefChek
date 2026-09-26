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
└── constants/sicted-practice-catalog-seed.ts  # 144 prácticas del manual real

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

Sembrado idempotente (`createMany` + `skipDuplicates`, botón explícito "Cargar catálogo", nunca automático al activar el módulo) desde `constants/sicted-practice-catalog-seed.ts`: **144 prácticas** extraídas del manual real *"Restaurantes y empresas turísticas de catering: Manual de buenas prácticas"* (`23_Restaurantes_y_empresas_de_catering_v4.pdf`), agrupadas en BP1 Personas (21) · BP2 Clientes (11) · BP3 Ventas (10) · BP4 Servicios externos (11) · BP5 Instalaciones y equipamiento (20) · BP6 Oficio (71, ya filtrados de los ítems exclusivos de Catering). 121 obligatorias / 23 recomendables, derivado del listado "Buenas prácticas obligatorias de la sección BPx" de cada sección del manual. Escala real de puntuación: **1 a 5, sin decimales**, con "No aplica" como casilla independiente (no un 6º valor).

> Nota histórica: el diseño original del plan se basó en un manual equivocado (confundido con un documento de APPCC), con una escala y una estructura de códigos que no existen en el manual real. Corregido antes de sembrar ningún dato — ver el journal de fase 9 sub-PR 1 para el detalle completo.

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

- **Motor de cobertura automática** ("N prácticas con evidencia automática nunca piden acción manual"): pertenecía al diseño basado en el manual equivocado (códigos de práctica que no existen en el catálogo real de 144). No se construye.
- **Autoevaluación/plan de mejora en el pack de auditoría de fase 5**: el informe anual de fase 9 cubre esa necesidad de otra forma (agregado propio), no se añadió a los PDFs existentes de fase 5.
- **Sin integración con la plataforma oficial SICTED**: la autoevaluación de este módulo es una herramienta de apoyo interno; la evaluación real la hace un evaluador externo humano en `calidadendestino.org` o equivalente. Todas las pantallas de autoevaluación lo rotulan explícitamente.
