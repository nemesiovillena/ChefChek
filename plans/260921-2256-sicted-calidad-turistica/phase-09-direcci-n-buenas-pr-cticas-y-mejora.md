---
phase: 9
title: "Dirección: buenas prácticas y mejora"
status: completed
priority: P3
effort: "L"
dependencies: [2, 4, 6, 7, 8]
---

# Phase 9: Dirección: buenas prácticas y mejora

## ⚠️ Corrección de fuente (2026-09-25) — ver detalle en `plan.md`

Todo este documento (secciones "Catálogo real", "Related Code Files", "Implementation Steps 1-2") describe el manual EQUIVOCADO (`BBPP_Restaurantes_y_empresas_turisticas_de_Catering.pdf`, en realidad un documento de APPCC). El manual real es `23_Restaurantes_y_empresas_de_catering_v4.pdf`: **144 prácticas** (BP1-BP6), escala **1-5 + "No aplica"** (no "1,3,4,5,6=NA"), sin los códigos `LEG`/`DIR`/`PER`/etc. de abajo. Ver `plan.md` → "⚠️ CORRECCIÓN CRÍTICA DE FUENTE" para la corrección completa y "Registro de implementación — Fase 9, sub-PR 1/4" para lo ya implementado con los datos correctos. Este documento se deja tal cual para trazabilidad del error, no se reescribe.

## Overview

Cierra el círculo SICTED: **catálogo de buenas prácticas** (pre-cargado del manual oficial, no importado a ciegas), **autoevaluación** con la escala real (1, 3, 4, 5, 6=NA), **cobertura de evidencias** por práctica, **plan de mejora**, objetivos anuales, participación en grupos de mejora/formación del destino, **documentación legal con caducidad**, y el **Informe anual de calidad** (`DIR.10`) como export agregado.

## Catálogo real (manual "Restaurantes y empresas turísticas de Catering", 2024)

Leído completo de `BBPP_Restaurantes_y_empresas_turisticas_de_Catering.pdf` (2026-09-23: usuario confirmó que es el manual vigente). Escala oficial: **1 (suspenso), 3 (aprobado), 4 (avanzado), 5 (sobresaliente), 6 = NA**. El 0 y el 2 no se usan, sin decimales. Obligatoria = mínimo 3; el título de la práctica lleva el sufijo "(RECOMENDABLE)" cuando no lo es.

Módulos que aplican a este oficio (17 base, siempre; + complementarios confirmados; + avanzados confirmados — decisión 2026-09-24):

| Módulo | Código | Prácticas | Ya cubiertas por Chefchek (evidencia automática) |
|---|---|---|---|
| Legislación | LEG | 6 | — (documental: normativa vigente, PRL, revisiones, plagas, protección de datos) |
| Dirección | DIR | 12 | — (objetivos, formación → fase 7, aspectos críticos, plan de contingencia, **Informe anual** = agregado) |
| Gestión de Personas | PER | 7 | — (organigrama/funciones → fase 7, vestuario, cortesía) |
| Relación con Clientes | CLI | 7 | — (quejas/satisfacción → fase 8) |
| Relación con Proveedores | PROV | 8 | `PROV.1` listado, `PROV.4` compras, `PROV.8` FIFO → **fase 6, automático** |
| Ventas y Marketing | V&M | 10 | — (mayormente protocolos de sala/precios, fuera del dominio de datos) |
| Facturación.Básico | Fac-Bas | 1 | — |
| Información.Básico | Inf-Bas | 1 | — |
| Instalaciones.Básico | Ins-Bas | 22 | `Ins-Bas.11` plan limpieza, `Ins-Bas.15` mantenimiento, `Ins-Bas.16` parte de averías → **fase 2–4, automático**; `Ins-Bas.17` objetos perdidos → **fase 8** |
| Medio Ambiente.Básico | Med-Amb | 9 | — (plantillas de ejemplo → fase 8) |
| Reserva.Básico | Rese-Bas | 3 | — |
| Restauración.Básico (sala) | Res-Bas | 16 | — |
| Restauración.Cocina.Básico | Res-Coc | 10 | `Res-Coc.4` escandallo, `Res-Coc.5` ficha técnica+alérgenos → **ya existe (`escandallos`/`technical-sheets`), automático**; `Res-Coc.6/7` limpieza cocina → fase 2 |
| Restauración.Higiene Alimentaria | Res-Hig | 6 | `Res-Hig.3` temperatura de cámaras → **plantilla del motor compartido `checklists`** (fase 2, `usedByModules` incluye `"sicted"` — ver decisión "motor de checklist compartido" en `plan.md`; no es lectura cruzada a otro módulo, es la misma tabla que consume `sicted`); `Res-Hig.4` etiquetado con fechas → **ya existe (`etiquetado`), automático** |
| Restauración.Restaurante (servicio) | Res-Res | 8 | — |
| Seguridad.Aforo / Básico / Recintos | Seg-* | 5 | — |
| Eventos (`Eve-Bas`, confirmado) | 8 | — (protocolo/orden de servicio, fuera del dominio de datos) |
| Restauración.Servicio en barra (`Res-Ser`, confirmado — ya con checklist real `BARRA WARY`) | 8 | limpieza de barra → **motor compartido, automático** (fases 2/4) |
| *(no aplican, confirmado)* Catering, Venta online | — | — |
| RSC y Sostenibilidad (`RSC`, avanzado, confirmado) | 11 | — |
| Diversidad funcional (`DIV`, avanzado, confirmado) | 10 | — |
| Innovación (`INN`, avanzado, confirmado) | 9 | — |

Total = 63 (base) + 8 (Eventos) + 8 (Barra) + 11 (RSC) + 10 (DIV) + 9 (INN) = **109 prácticas**. El JSON de sembrado se construye a mano desde el texto ya extraído (`código, título, área/módulo, isMandatory, textoResumen, documentoSugerido`), no por OCR ni import genérico.

## Requirements

- Funcional: catálogo pre-cargado (editable/ampliable); puntuar cada práctica con la escala real y evidencia (enlace a plantilla/registro/documento o a la evidencia automática de otro módulo); ver obligatorias sin evidencia o <3; acciones de mejora con responsable y fecha; objetivos anuales con indicador; eventos (grupo de mejora, formación destino, evaluación externa) con asistencia; documentos legales con vencimiento y alerta; **Informe anual de calidad** como export agregado.
- No funcional: autoevaluaciones cerradas inmutables; `SictedComplianceDoc.kind` es **etiqueta libre con sugerencias** (no enum rígido — la agrupación que recuerda el usuario de la plataforma SICTED no coincide 1:1 con los códigos del manual).

## Architecture

```
SictedPractice           id, tenantId, code (p.ej. "Res-Coc.4"), module (p.ej. "RESTAURACIÓN. COCINA. BÁSICO"),
                         area(INTERSECTORIAL|OBLIGATORIO_OFICIO|COMPLEMENTARIO|AVANZADO), title, isMandatory,
                         manualVersion ("2024"), autoEvidenceSource? (módulos operativos de solo lectura, ajenos
                         al motor de checklist: "escandallos" | "technical-sheets" | "etiquetado" | "albaranes" |
                         "supplier" | "lot") -- null si no hay evidencia automática; `Res-Hig.3` y el resto de
                         prácticas de limpieza/mantenimiento/temperatura NO usan este campo — se cubren por
                         `practiceRef` en `ChecklistTemplate` (motor compartido de fase 2/4), ver más abajo
SictedAssessment         id, tenantId, label ("Ciclo 2026"), assessedAt, status(DRAFT|CLOSED), closedAt?
SictedAssessmentScore    id, tenantId, assessmentId, practiceId, score(1|3|4|5|6_NA), evidenceNote?, linkedTemplateId?
                         -- score 6_NA = "No Aplica"; 0 y 2 no existen; sin decimales (aplicación, no DB, lo garantiza)
SictedObjective          id, tenantId, year, title, indicator?, target?, currentValue?, status
SictedImprovementAction  id, tenantId, code (correlativo por tenant, "Código incidencia"), origin(ASSESSMENT|
                         EVALUATOR|COMPLAINT|INCIDENT|OTHER), sourceRef?, title (el aspecto crítico en sí),
                         detectedAt, action (solución propuesta), responsibleName, dueDate,
                         status(OPEN|DONE|CANCELLED), closedAt? (fecha implantación), evidenceNote? (comentarios)
SictedEvent              id, tenantId, kind(GRUPO_MEJORA|FORMACION_DESTINO|EVALUACION_EXTERNA|OTRO), eventDate,
                         attended, notes?, attachment?
SictedComplianceDoc      id, tenantId, label (texto libre: "Extintores", "OCA Industria", "Convenio colectivo",
                         "Protección de datos"...), title, holderName?, issuedAt?, expiresAt?, attachment?
```

`SictedImprovementAction` confirmado 2026-09-24 contra `Dir.6.For_Registro aspectos críticos.doc`/`Dir.7` (real: Código incidencia, Aspecto crítico/Incidencia, Fecha de detección, Solución propuesta, Fecha implantación, Estado, Responsable, Comentarios) — coincide campo a campo; cubre `DIR.6`/`DIR.7` directamente sin ajustes adicionales.

Cobertura por práctica: si `autoEvidenceSource` está informado, la práctica se marca "con evidencia" automáticamente en cuanto el módulo origen tiene datos del periodo (sin acción del usuario). Si no, cobertura = plantilla activa con `practiceRef` = ese código (fase 2) + cobertura de registros del periodo (fase 5) o documento subido.

**Informe anual de calidad (`DIR.10`)**: export agregado (PDF), no un formulario manual. Compagina: aspectos críticos del año (`DIR.6/7`), eficacia del plan de formación (fase 7), satisfacción+quejas (fase 8), incidencias de proveedores (fase 6), resultados de inspecciones (si se registran como `SictedEvent`), plan de mejora anterior (`SictedImprovementAction` cerradas) y plan de contingencia vigente (`SictedComplianceDoc` o protocolo). Un botón "Generar informe anual" en vez de rellenar un documento aparte.

## Related Code Files

- Create: modelos+migración+triggers (Assessment cerrada, Scores de una evaluación cerrada → forbid); `backend/src/modules/sicted/services/{sicted-practice-catalog,sicted-assessment,sicted-improvement,sicted-legal-docs,sicted-annual-report}.service.ts`; controladores/DTOs.
- Create: `backend/src/modules/sicted/constants/sicted-practice-catalog-seed.ts` (las 109 prácticas confirmadas — 63 base + Eventos + Barra + 3 avanzados —, escritas a mano desde el texto del manual leído).
- Create (front): `frontend/src/app/dashboard/sicted/direccion/page.tsx` (Autoevaluación / Plan de mejora / Objetivos / Legal / Informe anual); botón "Cargar catálogo" cuando aún no hay prácticas sembradas; panel "cobertura SICTED" con semáforo por área.
- Reutilizar: cobertura de fase 5, adjuntos de fase 4, evidencias de fases 2/4/6/7/8.

## Implementation Steps

1. Manual y alcance ya confirmados (2026-09-23/24): 63 base + Eventos + Servicio en barra + los 3 avanzados = 109 prácticas.
2. Construir `sicted-practice-catalog-seed.ts` con las 109 prácticas.
3. Endpoint de siembra idempotente + botón explícito **"Cargar catálogo"** en la UI (confirmado, Validation Session 1: **no** se siembra solo al activar el módulo `sicted` — el tenant lo dispara a propósito, deja margen para elegir versión de manual en el futuro); catálogo editable después. <!-- Updated: Validation Session 1 - sembrado explícito, no automático -->
4. Autoevaluación (borrador editable → cierre inmutable) con selector de nota **1/3/4/5/NA** (no un slider continuo); comparación entre ciclos.
5. Motor de cobertura automática (`autoEvidenceSource`) + vínculo manual práctica↔plantilla/registro/documento.
6. Plan de mejora y objetivos; generación de acciones desde quejas/incidencias/evaluación.
7. Eventos y documentos legales con alertas de vencimiento (cron diario, idempotente).
8. Informe anual de calidad (agregado PDF).
9. Exportables al pack de auditoría (autoevaluación, plan de mejora, matriz de cobertura).

## Tests

- Siembra: idempotente, no duplica en reimport; respeta ediciones del tenant.
- Escala: rechaza valores fuera de {1,3,4,5,6}; sin decimales.
- Cierre de autoevaluación inmutable; cobertura automática correcta para las 6 prácticas con `autoEvidenceSource`.
- Informe anual: agrega correctamente datos de fases 2/4/6/7/8 de un tenant de prueba.
- Aislamiento tenant.

## Success Criteria

- [x] Catálogo de **144** prácticas reales cargado y puntuable con la escala real (1-5 + No aplica); obligatorias sin puntuar o <3 listadas. — sub-PR 1, ver `plan.md`.
- [~] 6 prácticas con evidencia automática nunca piden acción manual al usuario. — **no aplicable tras la corrección de fuente**: los códigos concretos (`Res-Coc.4/5`, `Res-Hig.3/4`, `PROV.1/8`...) pertenecían al manual equivocado y no existen en el catálogo real de 144 prácticas (BP1-BP6). El "motor de cobertura automática" tal como estaba diseñado no se construye; fuera de alcance de fase 9 tal como se cierra. Documentado, no silenciado.
- [x] Autoevaluación cerrada e inmutable (trigger condicional). — sub-PR 1. Exportable al pack de auditoría: no incluida (fuera de alcance de fase 9; el informe anual de sub-PR 4 sí agrega su resumen).
- [x] Plan de mejora con acciones trazables a su origen. — sub-PR 2: `origin`+`sourceRef`, generación directa desde obligatorias pendientes de una autoevaluación.
- [x] Informe anual de calidad se genera en un clic con datos reales del año. — sub-PR 4: agregado de fases 2/4/6/7/8/9, PDF + preview JSON.
- [x] Documentos legales próximos a caducar generan aviso. — sub-PR 3: cron diario a 30 días/vencido, idempotente, reseteado al renovar.
- [x] Objetivos anuales con indicador/meta/progreso. — sub-PR 2 (ya estaba en Requirements, añadido aquí por completitud).
- [x] Eventos (grupo de mejora, formación del destino, evaluación externa) con asistencia. — sub-PR 3, evidencia append-only.

**Fase 9 completada** (4/4 sub-PRs) — ver "Registro de implementación" en `plan.md` para el detalle de cada sub-PR y la corrección crítica de fuente del manual.

## Risk Assessment

- *Manual desactualizado*: si el usuario confirma que hay una versión más nueva, solo se reemplaza el seed — el modelo no cambia.
- *Falsa sensación de cumplimiento*: la nota es autoevaluación; la evaluación externa la hace un evaluador humano. Rotular claramente en UI ("herramienta de apoyo, no sustituye la evaluación oficial").
- *Alcance grande*: la fase más prescindible del MVP; puede entregarse por sub-PRs (catálogo → autoevaluación → mejora → legal → informe anual).
