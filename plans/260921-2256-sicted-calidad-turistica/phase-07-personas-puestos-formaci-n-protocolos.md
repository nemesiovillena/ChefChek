---
phase: 7
title: "Personas: puestos formación protocolos"
status: pending
priority: P2
effort: "M"
dependencies: [1]
---

# Phase 7: Personas: puestos, formación, protocolos

## Overview

Bloque "Personas" de SICTED: **fichas de puesto** (tareas y responsabilidades exactas), **plan anual de formación** (mínimo atención al cliente, idiomas, sostenibilidad, alérgenos) con asistencia y certificados, y **protocolos** (imagen/higiene personal/uniformidad, bienvenida, etc.) con **acuse de lectura versionado** por empleado.

## Requirements

- Funcional: CRUD de puestos y asignación de personas; plan formativo por año con acciones y asistencia; cobertura de temas mínimos; protocolos con versión, vigencia, revisión, y acuse por usuario.
- No funcional: acuses y asistencia **append-only**; datos personales mínimos (nombre y `userId`; nada de nóminas: `User.payrollEmail` ya existe y **no** se toca).

## Architecture

```
SictedJobProfile        id, tenantId, title, mission?, responsibilities Json[], tasks Json[], requirements?,
                        reportsTo?, version, archivedAt?
SictedJobAssignment     id, tenantId, profileId, userId, since, until?
SictedTrainingPlan      id, tenantId, year, status(DRAFT|ACTIVE|CLOSED)                      @@unique([tenantId, year])
SictedTrainingAction    id, tenantId, planId, topic(ATENCION_CLIENTE|IDIOMAS|SOSTENIBILIDAD|ALERGENOS|HIGIENE|OTRO),
                        title, plannedDate, hours?, trainer?, done(bool), doneAt?
SictedTrainingAttendance id, tenantId, actionId, userId, attended, certificate? Json, recordedAt  -- SOLO INSERT
SictedProtocol          id, tenantId, area, title, version, body (Text) | knowledgeArticleId?, validFrom,
                        reviewDueAt, archivedAt?
SictedProtocolAck       id, tenantId, protocolId, protocolVersion, userId, ackedAt                  -- SOLO INSERT
```

Decisión de contenido (confirmada 2026-09-24): **`knowledgeArticleId`** apuntando a la Wiki existente (editor Tiptap ya integrado, versiones en `KnowledgeVersion`) y SICTED añade solo lo que la Wiki no tiene: versión fijada en el acuse, vigencia y revisión. Verificar al empezar la fase cómo se numeran las versiones en `KnowledgeVersion`; si no encaja, usar `body` propio.

Alertas: protocolo con revisión vencida; acciones formativas sin asistencia registrada tras su fecha; empleado sin acuse de la versión vigente.

## Related Code Files

- Create: modelos+migración+triggers; `backend/src/modules/sicted/services/{sicted-job-profile,sicted-training,sicted-protocol}.service.ts`; controladores/DTOs.
- Create (front): `frontend/src/app/dashboard/sicted/personas/page.tsx` (pestañas Puestos / Formación / Protocolos) + componentes; pantalla "Mis protocolos pendientes" para USER (acusar lectura).
- Lectura: `users` (selector de personas); Wiki `conocimiento` (si se enlaza).

## Implementation Steps

1. Puestos + asignaciones (UI de tabla + ficha imprimible).
2. Plan formativo: crear año, acciones, marcar hecha, registrar asistencia (lote), adjuntar certificado (mismas reglas de subida que fase 4).
3. Vista "cobertura de temas mínimos" (los 4 temas del usuario) por año.
4. Protocolos + acuse; subir versión invalida acuses de la anterior (nueva ronda pendiente).
5. Exportables al pack de auditoría (PDF de fichas de puesto, plan formativo del año con asistencia, matriz protocolo × empleado).

## Tests

- Acuse versionado: nueva versión → pendientes de nuevo; acuse duplicado rechazado.
- Asistencia append-only; cobertura de temas.
- Aislamiento tenant; USER solo ve/acusa lo suyo; no expone datos de otros más allá de nombre.

## Success Criteria

- [ ] Todos los puestos activos tienen ficha; cada empleado con puesto asignado.
- [ ] Plan del año muestra cobertura de los 4 temas mínimos y asistencia por persona.
- [ ] Matriz protocolo × empleado indica quién no ha acusado la versión vigente.

## Risk Assessment

- *Datos personales (RGPD)*: mínimos y solo laborales; retención = la del tenant; documentar en docs.
- *Sobre-ingeniería de RRHH*: no hay nóminas, turnos ni contratos (fuera de alcance).
- *Deriva Wiki*: si el artículo cambia sin nueva versión SICTED, el acuse quedaría sobre texto distinto → el acuse fija `knowledgeVersion` y se avisa al editar un artículo enlazado.
