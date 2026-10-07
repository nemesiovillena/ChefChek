---
phase: 8
title: "Plan vs real alertas legales y coste"
status: pending
priority: P2
effort: "12-14h"
dependencies: [4, 7]
---

# Phase 8: Plan vs real, alertas legales y coste

## Overview

Cruza los turnos planificados con los fichajes reales, avisa de incumplimientos legales al planificar y muestra el coste laboral estimado. Cierra la Oleada 2.

## Requirements

- Funcional: detectar retraso, salida anticipada, ausencia sin fichar y exceso sobre el turno; alertas al crear/mover turnos; coste por día y semana.
- No funcional: las alertas avisan, no bloquean (salvo configuración); coste visible solo con permiso.

## Architecture

- `ScheduleRulesEngine` (función pura; umbrales tomados de los parámetros de convenio en `CheckInSettings`):
  - descanso entre jornadas < 12 h
  - más de 9 h ordinarias en un día
  - horas semanales planificadas > pactadas + margen
  - menos de 1,5 días de descanso semanal
  - horas extra acumuladas del año cerca de 80 h
- `PlanVsActualService`: por turno publicado, compara con la jornada efectiva (Fase 4); tolerancia configurable en minutos.
- Coste: `Employee.hourlyCost` × horas planificadas/reales; sección `checkin.cost` controla la visibilidad.
- Las alertas se calculan en servidor al cargar la semana y tras cada mutación.

## Related Code Files

- Create: `backend/src/modules/turnos/services/schedule-rules-engine.ts` (+ spec), `services/plan-vs-actual.service.ts` (+ spec), `services/labor-cost.service.ts`
- Modify: `backend/src/modules/turnos/schedule.controller.ts` (alertas y coste en la respuesta de semana), ajustes de turnos
- Modify: `frontend/src/features/turnos/components/schedule-grid.tsx`, `shift-card.tsx`; Create: `rule-alert-badge.tsx`, `plan-vs-actual-view.tsx`, `labor-cost-bar.tsx`
- Modify: panel de gerencia de la Fase 5 (retrasos y ausencias del día)

## Implementation Steps

1. Tests del motor de reglas con casos límite (turno partido, medianoche, semana que cruza mes).
2. Implementar motor y exponer alertas en la respuesta de semana.
3. `PlanVsActualService` con tolerancias; tests.
4. Coste laboral con control de permiso en backend (no solo ocultar en frontend).
5. Interfaz: distintivos de alerta en turno y fila, barra de coste, vista plan vs real por día.
6. Aviso al encargado si un empleado con turno publicado no ha fichado pasados N minutos (cron).

## Success Criteria

- [ ] Cada regla se dispara en su caso de prueba y no en el contrario
- [ ] Retraso y ausencia sin fichar visibles en el panel del día
- [ ] Coste no llega en la respuesta API a un rol sin permiso
- [ ] Umbrales editables por tenant
- [ ] Oleada 2 lista para uso real

## Risk Assessment

- Reglas no ajustadas al convenio del cliente → umbrales configurables y texto que aclara que son avisos orientativos.
- Coste hora incompleto (sin Seguridad Social) → etiquetar como "estimado".
