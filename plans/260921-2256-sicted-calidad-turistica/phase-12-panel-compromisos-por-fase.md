---
phase: 12
title: "Panel de compromisos por fase del ciclo SICTED"
status: pending
priority: P2
effort: "S"
dependencies: [11]
---

# Phase 12: Panel de compromisos por fase

## Overview

La metodología 2026 exige, además de la evaluación, compromisos por fase del ciclo (Adhesión → Distinción → Seguimiento 1 → Seguimiento 2 → Renovación; 12 meses por fase; comité mensual ~día 20; distintivo 3 años). La web SICTED tiene un "Visor de cumplimiento" (Legalidad, Manual de marca, MBP, Formación, ATI, ATC, Autoevaluación, Plan de mejora, Grupos de mejora, Evaluación externa). Chefchek no se integra con la web (sin API), pero puede mostrar el mismo visor calculado con lo que ya registra, para llegar al comité sin sorpresas. Warynessy está hoy en **Distinción** (solo Legalidad cumplida).

## Requisitos por fase (manual SICTED 2026, §8)

| Compromiso | Distinción | Seg. 1 | Seg. 2 | Renovación | Fuente en Chefchek |
|---|---|---|---|---|---|
| Legalidad vigente | protocolo firmado | aceptar casilla | aceptar casilla | declaración responsable firmada | `SictedComplianceDoc` (etiqueta sugerida "Declaración responsable") |
| Manual de marca | — | aceptar | — | — | check manual |
| Formación | curso básico Campus | ≥4 h | ≥4 h | ≥4 h | `SictedTrainingAction.hours` (done) en los 12 meses previos al comité; no acumula |
| ATI | 3 | — | — | 1 | `SictedEvent` kind `ATI` (nuevo) |
| ATC | 1 | 1 | 1 | 1 | `SictedEvent` kind `ATC` (nuevo) |
| Autoevaluación | obligatoria | recomendable | recomendable | obligatoria | `SictedAssessment` cerrada en la fase |
| Plan de mejora | ≥3 acciones | seguimiento | seguimiento | 3 ejecutadas | `SictedImprovementAction` |
| Grupo de mejora | — | ≥1 | ≥1 | ≥1 | `SictedEvent` kind `GRUPO_MEJORA` |
| Evaluación externa | completa | parcial | parcial | completa | `SictedEvent` kind `EVALUACION_EXTERNA`, ≤6 meses antes del comité |

## Requirements

- `SictedSettings` (creada en fase 11) + `cyclePhase` (ADHESION|DISTINCION|SEGUIMIENTO_1|SEGUIMIENTO_2|RENOVACION), `phaseStartedAt`, `nextCommitteeDate`. Editable en la sección SICTED de Configuración.
- `SictedEvent.kind` añade `ATI` y `ATC` (string, sin migración de enum).
- `SictedImprovementAction`: adjunto de evidencia (`attachment Json?`, mismo shape `StoredAttachment`) — el manual exige evidencias fechadas y específicas; `origin` añade `ASESORIA` y `FORMACION`. El PAC post-evaluación = acciones con `origin=EVALUATOR` + `dueDate` (solo etiqueta UI).
- Endpoint de solo lectura `GET sicted/commitments` que calcula el estado (cumple / en curso / sin iniciar / no aplica) por compromiso según la fase; sin tabla propia.
- Tarjeta "Compromisos" en la cabecera de SICTED (verde/ámbar/gris) + días hasta el comité.

## Related Code Files

- Modify: `backend/prisma/schema.prisma`, `sicted-direccion*.controller.ts`/servicios, `frontend/src/app/dashboard/sicted/page.tsx`, pestaña eventos y plan de mejora, `settings/components/sicted-config-section.tsx`.
- Create: `backend/src/modules/sicted/services/sicted-commitments.service.ts` (+ spec).

## Success Criteria

- [ ] Con Warynessy en Distinción, el panel muestra Legalidad en verde y el resto pendiente, coincidiendo con el visor de la web.
- [ ] Formación suma solo horas de los 12 meses previos al comité.
- [ ] Tests jest del cálculo por fase (tabla de arriba).

## Risks

- Reglas del programa pueden cambiar (rev. 1.1 ya corrigió plazos): reglas en una constante única comentada con la fuente, fácil de ajustar.
- Casillas que solo existen en la web (manual de marca, curso básico del Campus) → check manual, sin pretender verificarlas.
