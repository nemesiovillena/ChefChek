---
phase: 4
title: "Mantenimiento preventivo y correctivo"
status: pending
priority: P1
effort: "M"
dependencies: [1]
---

# Phase 4: Mantenimiento preventivo y correctivo

## Overview

Calendario anual de revisiones (filtros de climatización, motores de cámaras, extintores, control de plagas…) con **certificados adjuntos**, y partes de avería (detectada → técnico avisado → resuelta). Independiente de la fase 2 (solo necesita la guarda de fase 1 y el módulo `checklists`): se puede paralelizar con 2–3 si hay ficheros disjuntos.

**Decisión 2026-09-24 — motor compartido con APPCC** (igual que fase 2): mantenimiento y averías/desviaciones viven en el módulo neutro `checklists`, tablas `Checklist*` sin prefijo, con `usedByModules`. `control extintores` y el control de plagas por empresa externa (`LEG.5`) son ejemplos reales de mantenimiento que Warynessy ya usa para ambos fines.

## Requirements

- Funcional: inventario de equipos; plan de revisiones con periodicidad; registrar revisión hecha (fecha, quién, empresa externa, coste, notas, adjuntos); avisos de vencimiento; parte de avería simple (`Ins-Bas.16`) y parte de acciones correctivas más general (PAC) con hitos.
- No funcional: registros de revisión e incidencias **write-once**; adjuntos tenant-scoped; nada de esto depende de que `appcc` esté activo.

## Architecture

```
ChecklistAsset              id, tenantId, name, category(FRIO|COCINA|CLIMATIZACION|EXTINTORES|PLAGAS|ELECTRICO|OTRO),
                            usedByModules String[] ("sicted"|"appcc"), location?, provider?, isActive
ChecklistMaintenancePlan    id, tenantId, assetId, title, periodicityMonths, nextDueAt, lastDoneAt?,
                            externalProvider(bool), responsible?, isActive
ChecklistMaintenanceRecord  id, tenantId, planId, assetId, performedAt, performedByName, providerName?, cost?,
                            notes?, attachments Json [{path,name,mime,size}], recordedByUserId, recordedAt   -- SOLO INSERT
ChecklistIncident           id, tenantId, assetId?, usedByModules String[] ("sicted"|"appcc"),
                            kind(BREAKDOWN|CORRECTIVE_ACTION), partNumber? (correlativo por tenant, "Parte Nº"
                            — solo CORRECTIVE_ACTION), status(OPEN|NOTIFIED|RESOLVED), detectedAt, detectedByName,
                            -- BREAKDOWN (Ins-Bas.16 real): reportedTo? (servicio técnico), faultType (clase de avería),
                            technicianNotifiedAt?, serviceStartedAt?, serviceEndedAt?, resolvedAt?,
                            -- CORRECTIVE_ACTION (PAC real): processOrEquipment (proceso/instalación/equipo/producto),
                            deviationDescription, deviationCause?, correctiveMeasure?, responsibleName?, deadline?,
                            resolvedAt?, resolution?,
                            -- "SOLO CUANDO SEAN ALIMENTOS" (opcionales, solo CORRECTIVE_ACTION):
                            affectedLot?, affectedProductName?, affectedQuantity?
```

`ChecklistIncident`: fila que avanza por hitos; trigger "solo null→valor" en los campos de fecha/hora (no se pueden reescribir ni borrar). Registrar una revisión actualiza `ChecklistMaintenancePlan.lastDoneAt/nextDueAt` (el plan **no** es evidencia; el `Record` sí).

**Corregido 2026-09-24** contra los documentos reales: `Ins-Bas.16.For_Parte averías.doc` y `PARTE ACCIONES CORRECTIVAS` (cód. PAC, ICSAM) **son dos formularios distintos**, no uno — una revisión anterior los había fusionado por error. `Ins-Bas.16` es un parte de avería simple (a quién se avisa, clase de avería, hora de inicio/fin del servicio técnico). `PARTE ACCIONES CORRECTIVAS` es más general (cualquier desviación de proceso/instalación/equipo/producto, con causa raíz y medida correctiva), con una sección opcional "solo cuando sean alimentos" (lote, cantidad) — es el caso de checklist compartido con APPCC que el usuario anticipó, y ambos formularios reales aparecían tal cual en las dos carpetas (SICTED y APPCC). Una sola tabla con `kind` los distingue; el campo `deviationDescription`/`correctiveMeasure` no aplica a `BREAKDOWN` ni `reportedTo`/`faultType` a `CORRECTIVE_ACTION`.

Avisos: `@Cron` diario 08:00 Madrid en `ChecklistsModule` → `Alert` (campana) a 30 días y al vencer, idempotente por `(planId, umbral)`, uno por cada módulo activo en `usedByModules`. Mismo patrón que fase 2.

Adjuntos: `FileInterceptor` como en `products.controller.ts`, con la convención de uploads autenticados y por tenant (plan `260831-0031-uploads-auth-tenant-scoped`) y volumen persistente. Allowlist de mimetype **explícita** (PDF, JPG, PNG, HEIC): ya hubo un 400 en prod por allowlist que rechazaba jpg/HEIC. Límite de tamaño.

## Related Code Files

- Create: modelos + migración; `backend/src/modules/checklists/services/{checklist-asset.service.ts, checklist-maintenance.service.ts, checklist-incident.service.ts, checklist-maintenance-reminder.service.ts}` (sin controlador propio, igual que fase 2).
- Create: `backend/src/modules/sicted/sicted-maintenance.controller.ts` (`@Controller("api/v1/sicted/maintenance")`, `@RequireModule("sicted")`, filtra por `usedByModules` incluye `"sicted"`); DTOs.
- Create (front): `frontend/src/app/dashboard/sicted/mantenimiento/page.tsx` (+ pestañas: Calendario, Equipos, Averías) y componentes; `use-sicted-maintenance.ts`.
- Modify: `checklists.module.ts`, `sicted.module.ts`; nav (subenlace).
- **No** se toca el módulo `appcc` existente ni su modelo `PestControl`: la categoría `PLAGAS` de `ChecklistAsset` es la vía nueva y compartida; si en el futuro se rehace `appcc`, migra a leer de aquí en vez de `PestControl`. Decisión explícita, no ambigüedad.

## Implementation Steps

1. Modelos, migración y triggers (`ChecklistMaintenanceRecord` forbid; `ChecklistIncident` seal-por-hito) en `ChecklistsModule`.
2. Servicios + `SictedMaintenanceController` (ADMIN/OWNER crean equipos/planes; USER registra avería, registra revisión y resuelve — sin paso de supervisión, igual que el modo `EXECUTION` de fase 2: ningún documento real de mantenimiento/averías lleva firma de supervisor); filtro `usedByModules`.
3. Subida/descarga de adjuntos con comprobación de tenant en la descarga (no servir estáticos abiertos).
4. Recordatorios (cron + alertas).
5. UI: calendario anual (lista agrupada por mes + estado vencido/próximo/ok), ficha de equipo con histórico, formulario de revisión con adjuntos (input file `capture` en móvil), parte de avería simple y parte de acciones correctivas (dos formularios, `kind` distinto) con línea de tiempo.
6. Seed: `control extintores` (cód. BP5.10.1, `usedByModules: ["sicted","appcc"]`, categoría EXTINTORES, trimestral) como plantilla de equipo/plan ya confirmada.
7. Vincular con fase 5: exportación del calendario e histórico.

## Tests

- Cálculo de `nextDueAt` (fin de mes, años bisiestos), umbrales de aviso idempotentes.
- Mutación prohibida en `Record`; hitos de `ChecklistIncident` no reescribibles; orden lógico (no resolver sin detectada).
- Filtro `usedByModules`: activo/plan/incidencia solo-`appcc` → 404 desde `SictedMaintenanceController`.
- Subida: mimetype fuera de allowlist → 400; tenant B no descarga adjunto de A.

## Success Criteria

- [ ] Alta de equipo → plan → revisión con PDF adjunto → `nextDueAt` recalculado → alerta a 30 días.
- [ ] Parte de avería simple (`Ins-Bas.16`) y parte de acciones correctivas (PAC) son formularios distintos, ambos no editables a posteriori.
- [ ] Ningún adjunto accesible sin sesión del tenant correcto.
- [ ] Un equipo/plan compartido es una sola fila, no una por módulo.

## Risk Assessment

- *Almacenamiento*: certificados en volumen persistente; el backup JSON **no** incluye ficheros. Avisar en docs; la posible migración a Bunny.net (`chefchek`) es decisión ajena.
- *Datos personales en adjuntos*: facturas de técnicos, sin datos de clientes; no más.
- *Alcance*: no gestionar stock de repuestos ni costes contables (YAGNI).
