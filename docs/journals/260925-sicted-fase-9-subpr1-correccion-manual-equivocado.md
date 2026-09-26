# SICTED fase 9 (sub-PR 1/4): el catálogo llevaba dos días basado en el manual equivocado

**Fecha**: 2026-09-25 22:50
**Severity**: Alta (hallazgo de premisa, no de código — pudo haber sembrado 109 "prácticas de cumplimiento normativo" inventadas de un documento de APPCC, no de SICTED)
**Componente**: `backend/src/modules/sicted/{constants/sicted-practice-catalog-seed,dto/sicted-practice-catalog,dto/sicted-assessment,services/sicted-practice-catalog,services/sicted-assessment,sicted-direccion.controller,util/sicted-practice-code-util}.ts`, migración `sicted_practice_catalog_assessment`, `frontend/src/app/dashboard/sicted/{direccion/**,components/sicted-direccion-*}.tsx`
**Estado**: Commit pendiente en `feat/sicted-fase-9` (sobre `develop`, con fases 1-8 ya fusionadas)

## Qué pasó

Primer sub-PR de la fase 9 (dividida en 4 por su tamaño, decisión del usuario): catálogo de buenas prácticas + motor de autoevaluación (Dirección). Antes de escribir una sola línea de seed, el usuario corrigió algo que llevaba desde el diseño original del plan: **"lo que estás implantando es el manual de APPCC, no de SICTED"**. El PDF que el plan citaba como "manual SICTED vigente, confirmado 2026-09-23" (`BBPP_Restaurantes_y_empresas_turisticas_de_Catering.pdf`) era en realidad un documento de APPCC, confundido con el manual real de APPCC de Warynessy (`RPHT RESTAURANTE WARYNESSY 4.pdf`). El usuario compartió la carpeta real (`artefactos/SICTED/Manuales/`) y confirmó el archivo correcto: `23_Restaurantes_y_empresas_de_catering_v4.pdf`.

## La verdad brutal

Este no es un bug de código — es un bug de premisa, y de los graves: el plan llevaba desde su creación (22-23 sept) citando el manual equivocado, con una escala inventada ("1,3,4,5,6=NA" — no existe en ningún manual real de SICTED) y una estructura de módulos (`LEG`/`DIR`/`PER`/`PROV`/etc., "109 prácticas") que tampoco corresponde al manual real. Ocho fases anteriores no se vieron afectadas porque usaban documentos reales de Warynessy distintos (planes de limpieza, fichas de mantenimiento, formularios de incidencias — todos verificados uno a uno contra artefactos reales, no contra el manual mal identificado). Pero esta fase era la primera que dependía directamente del catálogo de prácticas del manual — y de haber seguido adelante sin la corrección del usuario, habría sembrado 109 registros de "cumplimiento normativo SICTED" que en realidad describían otra cosa.

Ninguna revisión de código habría atrapado esto: el código habría sido internamente consistente con la premisa equivocada — DTOs válidos, tests que pasan, escala aplicada correctamente... a la escala equivocada. Solo se detectó porque el usuario conocía el contenido real de ambos manuales y lo señaló antes de que se sembraran datos.

**Resolución**: releer el manual real completo. El `Read` nativo de PDF produce glifos ilegibles en este archivo concreto (problema del propio PDF, no de la herramienta — confirmado visualmente) — solución: `pdftotext -layout` (poppler, ya instalado). Extracción con un pipeline Python ad-hoc: regex de código+título con heurística de continuación de línea (títulos envueltos que terminan en conectores como "del"/"de"/"la" siguen a la línea siguiente hasta encontrar el tag de cierre `(R)/(C)/(R+C)`), cruce de cada práctica contra el resumen "Buenas prácticas obligatorias de la sección BPx" de su sección para derivar `isMandatory`, filtro de los 16 ítems de BP6 exclusivos de "Empresas de Catering" (Warynessy es solo Restaurante). Verificación antes de escribir el seed: 0 duplicados, 0 títulos truncados, 0 caracteres de codificación rota, 3 correcciones manuales de tag en ítems con el cierre `(R)/(C)/(R+C)` en la línea envuelta.

Resultado real: **BP1 Personas (21) + BP2 Clientes (11) + BP3 Ventas (10) + BP4 Servicios externos (11) + BP5 Instalaciones y equipamiento (20) + BP6 Oficio (71) = 144 prácticas**, escala **1-5 + "No aplica"** (casilla separada, no un 6º valor), **121 obligatorias / 23 recomendables**.

**Decisión del usuario sobre el alcance del daño**: no reabrir fase 6 (proveedores) pese a que este manual real sí pide una evaluación anual de proveedores (`BP4.4`, recomendable) que la fase 6 —basada en el manual equivocado— había documentado explícitamente como "el manual no lo pide". Se documenta como deuda técnica, no se corrige ahora.

## Detalles técnicos

- Modelos nuevos: `SictedPractice` (editable por tenant, `@@unique([tenantId, code])`, sembrado idempotente vía botón explícito "Cargar catálogo"), `SictedAssessment` (ciclo DRAFT→CLOSED), `SictedAssessmentScore` (escala 1-5 + `notApplicable` como campo, no como valor de score).
- Trigger nuevo `forbid_score_update_if_assessment_closed()`: caso no cubierto por los dos triggers genéricos existentes (`forbid_mutation`, `forbid_milestone_rewrite`) porque la inmutabilidad de una puntuación depende del estado de la tabla **padre** (`sicted_assessments.status`), no de las columnas de la propia fila. Usa `COALESCE(NEW."assessmentId", OLD."assessmentId")` para funcionar en INSERT/UPDATE/DELETE por igual.
- Mientras el ciclo está en DRAFT, `upsertScore` usa `upsert` normal a propósito (no `createMany`+`skipDuplicates` como el resto del módulo): la puntuación es editable por diseño durante el borrador, no es evidencia append-only.
- **Bug real de código encontrado en verificación de navegador** (el único de esta fase, y menor comparado con el hallazgo de premisa): el listado ordenaba `code` como string (`orderBy:[{bpSection:"asc"},{code:"asc"}]`), así que "1.10" salía antes que "1.2". Corregido con un comparador numérico en memoria (`sortByPracticeCode`), aplicado en `SictedPracticeCatalogService.list()` y `SictedAssessmentService.getScores()`.
- 134 suites/2020 tests unitarios backend (sin cambios) + 20 suites/135 tests e2e backend (8 nuevos: siembra idempotente de las 144 prácticas reales contando contra `SICTED_PRACTICE_CATALOG_SEED.length`, reimportar respeta ediciones del tenant, escala 1-5+notApplicable, inmutabilidad tras cierre vía trigger, rechazo a nivel de aplicación, doble cierre rechazado, `pendingMandatory` correcto, aislamiento de tenant) sin regresiones.
- Frontend: `tsc --noEmit`, `eslint`, `next build` limpios (`/dashboard/sicted/direccion`, 2 pestañas, con aviso explícito "Herramienta de apoyo a la autoevaluación interna — no sustituye la evaluación oficial").
- Verificación en navegador contra un tenant de prueba desechable (`fase9-browser-test`): carga de catálogo (144 confirmadas, BP1 con el desglose exacto 16 obligatorias/5 recomendables del pipeline de extracción), orden numérico correcto tras el arreglo, ciclo completo de autoevaluación (crear → puntuar 1.1=5 y 1.2=2 → banner de "121 obligatorias sin puntuar o por debajo de 3" bajó a 120 correctamente — solo 1.1 salió por tener ≥3 — → cerrar ciclo → estado bloqueado con candado y puntuaciones de solo lectura). Limpieza del tenant de prueba confirmó además que el trigger bloquea también un `deleteMany` directo sobre puntuaciones de un ciclo cerrado, no solo un `update` — tuvo que usarse el escape `chefchek.allow_evidence_purge` para poder limpiar. Nunca se tocó Warynessy; recuento de tenants/usuarios verificado idéntico antes/después (9/10).

## Alcance diferido

Sub-PRs 2-4 de fase 9 (Plan de mejora + objetivos; Eventos + documentos legales; Informe anual agregado) — pendientes, siguiendo la división por bloques aprobada por el usuario.

## Pendiente

- Red-team del plan completo sigue diferido por el usuario.
- Sub-PR 2 (Plan de mejora + objetivos) es el siguiente tras fusionar este.
- Sin push ni PR todavía — commit pendiente en `feat/sicted-fase-9`.
