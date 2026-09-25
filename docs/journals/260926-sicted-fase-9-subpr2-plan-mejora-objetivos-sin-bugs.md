# SICTED fase 9 (sub-PR 2/4): plan de mejora + objetivos, segunda fase sin bugs propios

**Fecha**: 2026-09-26 09:40
**Severity**: Baja (sin hallazgos reales — implementación directa sobre patrones ya maduros del plan)
**Componente**: `backend/src/modules/sicted/{dto/sicted-improvement-action,dto/sicted-objective,services/sicted-improvement-action,services/sicted-objective,sicted-direccion.controller}.ts`, `frontend/src/app/dashboard/sicted/components/sicted-direccion-{improvement,objectives}-tab.tsx`
**Estado**: Commit pendiente en `feat/sicted-fase-9-mejora-objetivos` (sobre `develop`, con sub-PR 1 de fase 9 ya fusionado)

## Qué pasó

Segundo sub-PR de la fase 9 (dividida en 4 bloques): plan de mejora (`SictedImprovementAction`) y objetivos anuales (`SictedObjective`). A diferencia del sub-PR 1 —dominado por la corrección del manual equivocado—, aquí no había ninguna incertidumbre de fuente que resolver: el diseño de `SictedImprovementAction` ya estaba confirmado desde el 2026-09-24 contra un documento real de Warynessy (`Dir.6.For_Registro aspectos críticos.doc`, no contra el manual mal identificado), así que esa parte del plan seguía siendo válida sin tocarla.

La pieza que sí era nueva: cerrar el círculo autoevaluación→plan de mejora que pide el propio manual real (el que se confirmó en el sub-PR 1) — un botón que, sobre una autoevaluación con obligatorias pendientes, genera automáticamente una acción de mejora por cada una. Se implementó como endpoint (`POST assessments/:id/generate-actions`) y se enganchó directamente en el banner de "obligatorias sin puntuar" de la pestaña Autoevaluación del sub-PR 1, no como una función aislada sin punto de entrada visible.

## La verdad brutal

**Segunda fase del plan (tras la fase 8) sin ningún bug propio que reportar**, ni en tests ni en la verificación completa en navegador. La explicación es la misma que en fase 8: esta pieza no inventa mecanismos nuevos, reutiliza tres patrones ya golpeados y corregidos en fases anteriores — hito "solo null→valor" con `forbid_milestone_rewrite` para `closedAt` (fases 4, 6, 7, 8, 9), correlativo por tenant vía `MAX+1` en vez de autoincrement (mismo criterio que `checklist-incident.service.ts` de fase 4, documentado allí por qué el soft-delete de otras entidades del proyecto rompió secuencias basadas en autoincrement), y entidad editable sin trigger para un "plan vivo" que se corrige mientras se trabaja (mismo criterio que las fichas de puesto y el plan de formación de fase 7 — no toda tabla SICTED es evidencia append-only, solo la que documenta un evento ya ocurrido).

La verificación en navegador fue la prueba real de que el puente autoevaluación→plan de mejora funciona de extremo a extremo, no solo en un test unitario aislado: se creó un ciclo, el banner mostró "121 obligatorias sin puntuar o por debajo de 3", se pulsó "Generar acciones de mejora" y aparecieron exactamente **121** acciones nuevas en la pestaña Plan de mejora — el número coincidiendo dígito a dígito con el banner es la evidencia de que `pendingMandatory()` (del sub-PR 1) y `generateFromAssessment()` (de este sub-PR) están leyendo la misma fuente de verdad sin desincronizarse.

## Detalles técnicos

- `SictedImprovementAction`: `code` (correlativo, `MAX+1`), `origin`/`sourceRef` (traza el aspecto crítico hasta su fuente: autoevaluación, evaluador externo, queja, incidencia, otro), `title`/`action`/`responsibleName`/`dueDate` editables, `status` (OPEN/DONE/CANCELLED), `closedAt` protegido por trigger.
- `SictedObjective`: `year`/`title`/`indicator`/`target`/`currentValue`/`status`, sin trigger — se actualiza durante todo el año.
- `generateFromAssessment()`: dedupe por título ya generado para esa `sourceRef` — reintentar sobre la misma autoevaluación no duplica (verificado en e2e y en navegador).
- 134 suites/2020 tests unitarios backend (sin cambios) + 21 suites/141 tests e2e backend (6 nuevos: correlativo por tenant, edición de una acción, hito `closedAt` con traducción de error legible, generación desde autoevaluación sin duplicar en reintento, objetivos con filtro por año y progreso, aislamiento de tenant) sin regresiones.
- Frontend: `tsc --noEmit`, `eslint`, `next build` limpios — 2 pestañas nuevas en `/dashboard/sicted/direccion` (Plan de mejora con filtro por estado y fila expandible; Objetivos con selector de año), más el botón "Generar acciones de mejora" añadido al banner existente de la pestaña Autoevaluación.
- Verificación en navegador contra un tenant de prueba desechable (`fase9-subpr2-browser-test`): ciclo completo — banner "121 obligatorias" → generar acciones → 121 acciones creadas en Plan de mejora → editar una (solución + responsable) → marcar implantada → campos bloqueados con "Fecha de implantación: 26/9/2026" en la pestaña "Hechas" → objetivo anual creado con indicador/meta → progreso actualizado. Nunca se tocó Warynessy; recuento de tenants/usuarios verificado idéntico antes/después (9/10).

## Alcance diferido

Sub-PRs 3-4 de fase 9 (Eventos + documentos legales; Informe anual agregado) — pendientes, siguiendo la división por bloques aprobada por el usuario.

## Pendiente

- Red-team del plan completo sigue diferido por el usuario.
- Sub-PR 3 (Eventos + documentos legales) es el siguiente tras fusionar este.
- Sin push ni PR todavía — commit pendiente en `feat/sicted-fase-9-mejora-objetivos`.
