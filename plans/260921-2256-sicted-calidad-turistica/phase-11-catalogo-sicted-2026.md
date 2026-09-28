---
phase: 11
title: "Catálogo SICTED 2026 (sustituye al manual v4 de 2015)"
status: completed
priority: P1
effort: "M"
dependencies: [9]
---

# Phase 11: Catálogo SICTED 2026

## Overview

La metodología SICTED 2026 (manual SEGITTUR rev. 1.1, ago-2026) reorganiza los Manuales de Buenas Prácticas (MBP): capítulo (intersectorial / oficio / complementario) × eje (sostenibilidad económica / social / ambiental) × módulo; cada BP es **obligatoria** o **de mejora**. El catálogo sembrado en fase 9 (144 prácticas BP1–BP6 de `23_..._v4.pdf`, **marzo 2015**) queda obsoleto. No existe MBP en PDF por oficio: la fuente oficial es la Biblioteca de sicted.es.

## Fuentes (en `artefactos/SICTED/Manuales/2026/`)

- `Índice global de BBPP_20260618.xlsx`, hoja "BBPP por oficio", cols. 67-68 = "Restaurantes y empresas de catering". Fuente de verdad de **qué** BP aplican: 258 de oficio (74 O / 184 M; 20 marcadas "Evaluación fases seguimiento" = esenciales) + 78 complementarias (38 O / 40 M). Columnas "No aplica si unipersonal / sin personal / online".
- `BP oficios Eje SOST. {ECONÓMICA,SOCIAL,AMBIENTAL}_2026*.pdf` + `BP intersectoriales Eje SOST. {…}_2026*.pdf`: tablas con descripción, no aplica, requiere doc, documento, plantillas, BBPP relacionadas, fórmulas complementarias, ODS, ámbito competitividad.
- `Guía para la configuración de los MBP_202606018.pdf` (pág. ~82): módulos de oficio y complementarios de Restaurantes con la condición de inclusión de cada complementario.

## Decisiones (usuario, 2026-09-28)

- Cargar las 258 BP de oficio siempre; las 78 complementarias se cargan pero solo cuentan si su módulo está activado.
- Activación de módulos complementarios: sección **SICTED en Configuración** del tenant (ADMIN/OWNER), patrón de `settings/components/etiquetado-config-section.tsx`, visible solo con el módulo `sicted` activo. El superadmin sigue controlando solo el on/off del módulo `sicted` (MODULE_REGISTRY). Motivo: es configuración del propio negocio (espeja lo que el asesor configura en la web SICTED), no del contrato.
- Autoevaluación: **Cumple / No cumple / No aplica** (el manual 2026 no menciona escala 1–5). Revisar cuando el asesor configure el MBP en la web.
- Solo hay datos del catálogo viejo en local (nada en prod): sin migración de datos de producción, pero **cero pérdida** igualmente — el catálogo v4 se archiva, no se borra.

## Requirements

- `SictedPractice`: nuevos campos `chapter` (INTERSECTORIAL|OFICIO|COMPLEMENTARIO), `axis` (ECONOMICO|SOCIAL|AMBIENTAL), `moduleCode` ("107"), `moduleName`, `description`, `isEssential` (evaluación parcial), `requiresDocs`, `requiredDocs`, `templates`, `relatedCodes`, `notApplicableWhen` (U/sin personal/online + texto), `ods`, `competitivenessScopes`. `code` = 4 dígitos ("0532"). `manualVersion = "SICTED 2026 (Índice 20260618)"`. `bpSection`/`bpSectionName` pasan a opcionales (solo legado v4).
- Nueva tabla `SictedSettings` (1 fila por tenant): `enabledComplementaryModules String[]` (fase 12 añade aquí fase del ciclo y fecha de comité).
- `SictedAssessmentScore`: nuevo `result` (CUMPLE|NO_CUMPLE) junto a `notApplicable`; `score` 1–5 queda solo para evaluaciones legado. Trigger `forbid_score_update_if_assessment_closed` sin cambios.
- Seed idempotente "Cargar catálogo 2026": archiva (`archivedAt`) las prácticas `manualVersion="Restaurantes v4"` y crea las 336; nunca borra ni toca autoevaluaciones existentes.
- Autoevaluación nueva: solo prácticas no archivadas de oficio + complementarias activadas; filtros por eje/módulo; badge Obligatoria / De mejora / Esencial; pendientes = obligatorias sin "Cumple".
- Enlace práctica → evidencia existente (lectura, sin motor de cobertura): 0532 temperatura cámaras → checklist temperatura; 0515 escandallo → escandallos; 0516 receta → recetas/fichas técnicas; 0517/0518 plan limpieza cocina → checklists limpieza; 0534 etiquetado fechas → etiquetado/caducidades. Tabla estática en constantes, ampliable.

## Related Code Files

- Modify: `backend/prisma/schema.prisma` (+ migración aditiva vía `migrate diff`), `backend/src/modules/sicted/constants/sicted-practice-catalog-seed.ts` (→ nuevo seed 2026; el v4 se conserva para no romper el archivado), servicio/controlador de dirección (catálogo + autoevaluación), `frontend/src/app/dashboard/sicted/components/sicted-direccion-assessment-tab.tsx`, `frontend/src/app/dashboard/settings/page.tsx`.
- Create: `scripts/sicted/extract-bbpp-2026.py` (genera el seed desde Excel+PDF), `frontend/src/app/dashboard/settings/components/sicted-config-section.tsx`, endpoints GET/PATCH `sicted/settings`.

## Implementation Steps

1. Script de extracción: Excel → lista de BP de Restaurantes (código, capítulo, eje, módulo, O/M, esencial, no-aplica). PDFs (`pdftotext -layout`, parseo por columnas; código partido en 2 líneas, p. ej. `EC/O 10/7 05 32`) → descripción, documentación, plantillas, relacionadas, ODS. **Verificar**: 336 códigos del Excel encontrados en PDFs, 74/184/38/40 cuadran, 20 esenciales. Genera el seed TS (datos, no lógica).
2. Migración aditiva + seed idempotente con archivado del v4.
3. `SictedSettings` + sección SICTED en Configuración (checkbox por módulo complementario, con la condición de la Guía como ayuda: "Eventos: si se realizan eventos"…).
4. Autoevaluación con Cumple/No cumple/No aplica y filtros; informe anual lee el nuevo resultado.
5. Textos UI: "Compromiso de Turismo Responsable", "de mejora" (no "recomendable").
6. Tests jest: seed idempotente (2 ejecuciones = mismas filas, v4 archivado no borrado), filtro complementarias, trigger de cierre sigue bloqueando.

## Success Criteria

- [x] 336 prácticas 2026 cargadas con descripción; conteos 74/184/38/40 verificados contra el Excel (24 esenciales: 20 de oficio + 4 complementarias).
- [x] Catálogo v4 archivado, autoevaluaciones previas intactas (e2e).
- [x] Activar "Eventos" en Configuración añade sus BP a la autoevaluación; desactivarlo las oculta sin borrar respuestas (e2e + navegador: 258 → 271 con Eventos+Barra).
- [x] Guía de uso en `/dashboard/sicted/ayuda`, enlazada desde la portada SICTED (petición del usuario 2026-09-28).
- Local: 2031 tests unitarios + 19 e2e SICTED en verde; falta la CI del PR.
- [ ] CI verde (lint/build/unit/E2E).

## Risks

- Parseo de PDF por columnas frágil → la verificación cruzada con el Excel es obligatoria; si falla una BP, descripción vacía antes que inventada.
- Licencia CC BY-NC-ND de SEGITTUR: uso interno del restaurante, sin redistribuir el texto fuera de la app.
- Escala: si la web usa otra valoración al configurar el MBP, añadir valor al enum (aditivo).
