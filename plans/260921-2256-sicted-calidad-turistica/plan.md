---
title: "SICTED: módulo de calidad turística (registros auditables)"
description: >-
  Módulo propio `sicted` (independiente de APPCC) para que un restaurante
  genere las evidencias que exige el distintivo SICTED: Plan (manual) +
  Registros digitales inalterables de limpieza/apertura/cierre/confort,
  mantenimiento preventivo y correctivo, y pack de auditoría. Después:
  proveedores, personas, cliente, sostenibilidad y autoevaluación.
status: in-progress
priority: P2
branch: "feat/sicted-calidad-turistica"
tags:
  - backend
  - frontend
  - prisma
  - sicted
  - calidad
  - registros
  - auditoria
blockedBy: []
blocks: []
created: "2026-09-21T20:59:49.361Z"
createdBy: "ck:plan"
source: skill
---

# SICTED: módulo de calidad turística (registros auditables)

> **SOLO PLAN. No implementar nada hasta que el usuario confirme las decisiones y responda las preguntas abiertas del final.**
> Crear la rama `feat/sicted-calidad-turistica` desde `develop` (la rama actual `fix/albaran-confirmar-idempotente` es ajena).

## Overview

Regla de oro del evaluador SICTED: **"lo que no está registrado, no se ha hecho"**. Chefchek no "cumple SICTED" por sí mismo: produce **evidencias trazables** (quién, cuándo, qué, validado por quién) y las empaqueta para la evaluación. El corazón es un **motor de registros** con dos caras de un mismo dato:

- **Plan (la teoría)**: plantilla con ítems (qué se limpia, frecuencia, producto+dosis+EPI, procedimiento, responsable). Se exporta como manual PDF.
- **Registro (la práctica)**: una hoja por periodo (día/semana/mes) que el personal marca en pantalla táctil; el encargado valida (doble validación); observaciones para lo no realizado. Queda **inalterable**.

## Decisiones de producto (confirmadas con el usuario)

| Tema | Propuesta | Por qué |
|---|---|---|
| SICTED ≠ APPCC | Módulo propio `sicted`: id de registro, sección `sicted`, tablas `sicted_*`, rutas `api/v1/sicted`. **No se toca `appcc`** ni sus tablas. | Petición explícita del usuario: quiere poder activar/desactivar cada uno por separado (`MODULE_REGISTRY`). Además `CleaningTask` de APPCC es un único booleano `completed` (schema.prisma:935) y no sirve como registro diario. |
| Motor de checklist **compartido** entre SICTED y APPCC, activación **independiente** | El motor de plantillas/hojas/marcas (limpieza, mantenimiento, averías, temperatura — fases 1-4) vive en un módulo NestJS neutro `checklists` (tablas `Checklist*`, sin marca de "sicted" ni "appcc"), **no** en `sicted`. Cada plantilla lleva `usedByModules: ('sicted'\|'appcc')[]`. `sicted` y `appcc` mantienen sus propios `@RequireModule`/rutas/nav (independientes, como siempre) y ambos consultan ese motor filtrando por su nombre en `usedByModules`. Nadie marca el mismo checklist dos veces; apagar uno no borra ni oculta los datos del otro. | 2026-09-24: decisión final del usuario tras plantear el trade-off (opciones: compartir con acceso independiente / todo separado / aplazar) — eligió compartir. Resuelve la tensión entre su petición inicial (activar cada módulo por separado) y esta última (no duplicar información): son ortogonales — "activable por separado" es propiedad de las rutas/guards, no de dónde vive el dato. **Sustituye** la decisión anterior "SICTED nunca depende de APPCC activo". El módulo `appcc` del código (hoy con bug de rutas, esquema distinto) **no se reconstruye en este plan** — solo se deja el motor compartido listo para que un futuro plan de APPCC lo consuma sin reescritura. Prácticas `Res-Hig.3`/`Res-Coc.6/7`/mantenimiento ya no necesitan "plantilla SICTED propia sin leer APPCC": son plantillas del motor compartido con `usedByModules` incluyendo `sicted`, y punto — ni dependen de APPCC ni duplican dato. Cruces de solo lectura con módulos operativos (proveedores, albaranes, etiquetado, escandallos, fichas técnicas, almacenes) se mantienen igual, sin cambios. |
| Plan vs Registro | Un solo modelo Plantilla+Ítems genera ambos. Cada hoja de registro guarda un **snapshot** de la plantilla al crearse. | DRY; editar el plan mañana no reescribe el historial. |
| Inalterabilidad | Append-only: entradas se insertan, nunca se editan ni borran; corrección = nueva entrada con motivo. Trigger Postgres bloquea UPDATE/DELETE, con escape controlado (ver fase 1). Sin hash-chain (YAGNI) salvo que el usuario lo pida. | Un DBA siempre puede alterar; el objetivo real es que ni la app ni un descuido lo hagan y que quede rastro. |
| "Quién" real | Cada marca lleva **persona que ejecutó** (selector de plantilla de personas) además de la cuenta de sesión. | Cocina usa cuenta compartida ("Warynessy"): ya nos mordió en etiquetado (`responsibleUserId`/`responsibleName`). Sin esto, "usuario que lo completó" no vale como evidencia. |
| Fecha/hora | Solo del servidor; periodos en Europe/Madrid. | Evita relojes de tablets y desfases UTC. |
| Activación | `defaultEnabled: false` (como `etiquetado`); se activa por tenant. | No afecta a tenants existentes. |
| Catálogo de buenas prácticas | **Pre-cargado** desde el manual oficial 2024 de "Restaurantes y empresas turísticas de Catering": 109 prácticas = 63 base (17 módulos) + Eventos (8) + Servicio en barra (8) + los 3 avanzados RSC/Diversidad funcional/Innovación (11+10+9), vía endpoint idempotente; editable/ampliable por el tenant. | Ya leído completo (ver Hallazgos del manual oficial); evita depender de un import manual para arrancar. |
| Plataforma oficial SICTED | Sin integración. La autoevaluación oficial se hace allí; aquí se espeja y exporta. | No hay API pública verificada; YAGNI. |
| MVP | Fases 1–5. Fases 6–9 incrementales, cada una desplegable sola. | Es lo que el usuario detalló con más precisión y lo que el auditor mira primero. |
| Supervisor | Rol ADMIN/OWNER, sin flag propio nuevo. | 2026-09-24, confirmado. Jefe de cocina/encargado ya tienen ese rol hoy. |
| Identidad en cuenta compartida | Selector de persona **sin PIN**. | 2026-09-24, confirmado (el usuario prefirió simplicidad frente a la robustez extra del PIN). |
| Restore vs inalterabilidad | `checklist_*` y `sicted_*` **excluidas del restore por defecto**; incluirlas exige confirmación explícita aparte. | 2026-09-24, confirmado. |
| Protocolos narrativos | Viven en la Wiki (`conocimiento`, Tiptap) con vigencia/revisión y acuse de lectura versionado por SICTED encima. | 2026-09-24, confirmado. |
| Quejas/sugerencias | Solo captura interna (personal). Sin formulario público por QR. | 2026-09-24, confirmado — evita antispam/RGPD de un formulario público. |
| Tablet de cocina | Wifi siempre disponible. **Sin cola offline**. | 2026-09-24, confirmado. |
| Km 0 / proveedor local | Checklist manual de sostenibilidad. **No se toca** el módulo Proveedores/`Supplier`. | 2026-09-24, confirmado — mantiene el alcance dentro de SICTED. |
| Módulos complementarios del manual | **Eventos** y **Restauración.Servicio en barra** aplican (ya con checklist real, `BARRA WARY`). Catering y Venta online **no** aplican. | 2026-09-24, confirmado. |
| Módulos avanzados del manual | **Sí se persiguen**: RSC y Sostenibilidad, Diversidad funcional, Innovación, además del distintivo base. | 2026-09-24, confirmado. |

Nota de nomenclatura: SEGITTUR ya denomina SICTED "Sostenibilidad, Inteligencia y Calidad Turística en el Ecosistema del Destino" (no "Sistema Integral…"). Solo afecta a textos de UI/docs.

## Hallazgos del manual oficial (leído 2026-09-22)

El usuario adjuntó `BBPP_Restaurantes_y_empresas_turisticas_de_Catering.pdf` (101 págs., Secretaría de Estado de Turismo, 2024 — el manual vigente para el oficio "Restaurantes y empresas turísticas de Catering"; **no** el de la Junta de Andalucía que había encontrado antes por web, que estaba en imágenes y no se pudo leer). El usuario dudaba al principio de que fuera "el manual actual" — **confirmado 2026-09-23** que sí lo es.

Correcciones al diseño anterior:

- **Escala real: 1, 3, 4, 5, o 6=NA.** El 0 y el 2 no existen; sin decimales. Obligatoria = nota mínima 3. El texto marca "(RECOMENDABLE)" en el propio título cuando **no** es obligatoria; lo demás sí lo es. Corrige `SictedAssessmentScore` de fase 9 (tenía 1–5 continuo).
- **Estructura real de módulos** (tabla "Módulos aplicados al establecimiento", pág. 3) para este oficio:
  - **Intersectoriales** (aplican siempre): `LEG` Legislación, `DIR` Dirección, `PER` Gestión de Personas, `CLI` Relación con Clientes, `PROV` Relación con Proveedores, `V&M` Ventas y Marketing.
  - **Módulos obligatorios del oficio** (aplican siempre a este oficio): `Fac-Bas` Facturación, `Inf-Bas` Información, `Ins-Bas` Instalaciones (22 prácticas: aquí viven limpieza, mantenimiento preventivo, parte de averías, botiquín, **objetos perdidos**), `Med-Amb` Medio Ambiente, `Rese-Bas` Reserva, `Res-Bas` Restauración/sala, `Res-Coc` Restauración.Cocina (escandallo, ficha técnica, plan de limpieza cocina), `Res-Hig` Restauración.Higiene Alimentaria (temperatura de cámaras, manipulación — se solapa con APPCC), `Res-Res` Restauración.Restaurante (servicio de mesa), `Seg-Afo`/`Seg-Bas`/`Seg-Rec` Seguridad.
  - **Actividades complementarias**: **confirmado 2026-09-24** — Eventos y Restauración.Servicio en barra aplican (8+8 prácticas); Catering y Venta online no aplican.
  - **Gestión avanzada**: **confirmado 2026-09-24** — se persiguen los 3 módulos avanzados (RSC y Sostenibilidad 11, Diversidad funcional 10, Innovación 9), no solo el distintivo base.
  - Total: 63 (17 módulos base) + 8 (Eventos) + 8 (Barra) + 11+10+9 (avanzados) = **109 prácticas**.
- **El catálogo ya no bloquea la fase 9**: las 109 prácticas están listas para sembrarse desde este manual vía botón explícito "Cargar catálogo" (endpoint idempotente, igual que las plantillas de ejemplo de fase 2; **no** automático al activar el módulo — confirmado en Validation Session 1).
- **"Objetos perdidos" (Ins-Bas.17)** es una práctica real que no estaba contemplada: formulario simple (objeto, fecha, características, devuelto). Añadido a fase 8 (agrupa con Clientes, como indicó el usuario), no a fase 4.
- **Proveedores: mi diseño anterior inventaba una "evaluación 1-5" que el manual no pide.** Pide en su lugar: listado con datos+RSI (`PROV.1`, evidencia — ya existe `Supplier`), criterios de selección documentados (`PROV.2`, documento, no registro), **incidencias con proveedores** (`PROV.3`, registro nuevo, simple), directrices de recepción (`PROV.6`, documento; el control real de temperatura/caducidad/etiquetado en recepción ya lo hacen OCR+`Lot`+etiquetado), stock mínimo/máximo + inventario semestral (`PROV.7` — mínimo y máximo **ya existen**: `Stock.minimumStock`/`Stock.maximumStock`; el inventario es un snapshot firmado, no un registro manual — ver revisión 2026-09-24 contra los formularios reales), FIFO (`PROV.8`, evidencia — ya lo hace `Lot`). Fase 6 rediseñada.
- **Patrón "evidencia de módulo existente" se generaliza, con un límite**: `Res-Coc.4`/`Res-Coc.5` (escandallo y ficha técnica) se marcan cubiertas leyendo `escandallos`/`technical-sheets` de solo lectura, sin nada nuevo que construir — son módulos operativos, no de cumplimiento. **`Res-Hig.3` (temperatura de cámaras) es distinto y ya no necesita este patrón**: tras la decisión "motor de checklist compartido" (2026-09-24, más abajo), es una plantilla del motor `checklists` con `usedByModules` incluyendo `"sicted"` — ni lectura cruzada a APPCC ni plantilla duplicada, la misma tabla sirve a ambos módulos. *(Nota histórica: la primera versión de este hallazgo, del 22-23/09, decía que SICTED necesitaba "su propia plantilla sin depender de APPCC"; quedó superada por la decisión de compartir motor.)*
- **"Informe anual de calidad" (`DIR.10`)** es un documento concreto que el manual pide una vez al año, y que agrega piezas que ya planeamos por separado: aspectos críticos (`DIR.6`/`DIR.7`), eficacia del plan de formación, satisfacción y quejas (`CLI`), incidencias de proveedores, inspecciones, plan de mejora anterior y plan de contingencia. Se añade como un export agregado en fase 9 en vez de un documento manual aparte.
- La agrupación por "sub-temas" que dio el usuario de memoria (p. ej. "Legislación: Convenio, Extintores, OCA Industria, Protección de datos, Seguridad e higiene") no coincide exactamente con los códigos oficiales del manual (que agrupa por LEG.1–LEG.6), probablemente porque es la vista de la plataforma `calidadendestino.org`, no del manual en PDF. Se resuelve dejando `SictedComplianceDoc.kind` como etiqueta libre con sugerencias, no un enum rígido — cubre ambas vistas sin comprometerse a una taxonomía que no he verificado en la plataforma real.

## Artefactos reales de Warynessy (leídos 2026-09-24)

El usuario compartió la carpeta `/Users/nemesioj/Documents/Trabajos offline/ChefChek/artefactos/SICTED/` — ~95 documentos reales, organizados con la misma taxonomía que ya usaba de memoria (Intersectoriales/Clientes/Dirección/Legislación turística/Personas/Proveedores/Satisfacción/Ventas y marketing, Medio ambiente, Módulos Obligatorios del Oficio/Instalaciones/Seguridad), preparados originalmente por una consultora externa (ICSAM — Seguridad Alimentaria & Medio Ambiente) con código de documento propio (`RE 2-1`, `RE 4-2`, `BP5.10.1`...). Convertidos a texto con `textutil -convert txt` (macOS nativo, sin usar la skill de docx — mucho más barato para solo leer contenido) y revisados uno a uno los prioritarios.

**Hallazgo de fondo, cambia fase 2**: no hay un solo tipo de checklist, hay **tres modos** (ejecución/tarea, inspección/estado, medición/valor) — ver tabla de fase 2. La frecuencia va por ítem, no por toda la plantilla (`PLAN DE LIMPIEZA Y DESINFECCIÓN RESTAURANTE WARYNESSY2010.docx`, 938 líneas: una misma zona mezcla ítems diarios/semanales/mensuales/"después de cada uso").

**Ajustes concretos por fase** (detalle en cada phase file): fase 4 — `PARTE ACCIONES CORRECTIVAS` es un único formulario para avería de equipo y desviación de producto/lote (el caso de checklist compartido con APPCC que el usuario anticipó: se resuelve con campos opcionales, sin depender de APPCC activo); `control extintores` confirma el diseño de mantenimiento trimestral tal cual. Fase 6 — `PROV.7` es **inventario semestral**, no anual, y su contenido (producto/stock real/mínimo/máximo) ya vive en `Stock`; `PROV.1` pide más campos de cumplimiento que `Supplier` no tiene (tabla nueva, sin tocar `Supplier`); las "incidencias con proveedores" reales son de recepción (con nº de albarán, temperatura, causa de rechazo). Fase 8 — objetos perdidos con campos más simples que el diseño anterior. Fase 9 — `Dir.6`/`Dir.7` (aspectos críticos) coinciden campo a campo con `SictedImprovementAction`.

**Pendiente**: el usuario tiene además checklists específicos del propio "Plan de limpieza" por enviar — cuando lleguen, se cotejan contra el mapeo de frecuencia-por-ítem de fase 2 y se ajusta si hace falta. El seed de plantillas de fase 2 usa `limpieza cocina wary.docx`, `ALMACEN WARY.docx`, `ASEOS COCINA.docx`, `Ficha-maestra-Revisión limpieza.doc` y `Ficha-Comprobación Temperaturas.doc` como base ya confirmada; deja de haber plantillas de ejemplo inventadas para limpieza — solo donde no exista hoja real de Warynessy.

### Carpeta APPCC (revisada 2026-09-24, fuera de alcance de este plan)

El usuario compartió también `.../artefactos/APPCC/` para que la organizara. Casi todo son **los mismos documentos** ya vistos en la carpeta SICTED (confirma la lógica de checklists compartidos), más algunos nuevos:

- `BARRA WARY.docx` / `COMEDOR WARY.docx`: dos áreas de limpieza (`EXECUTION`) que faltaban — se añaden al seed de fase 2 junto a las ya confirmadas.
- `Ficha-maestra-Revisión mantenimiento, manipuladores y plagas.doc` (cód. RE 04-01, mensual): misma estructura `INSPECTION` (BIEN/MAL/OBSERVACIONES + doble firma) que la de limpieza, pero para higiene del manipulador (indumentaria, hábitos, joyas...) y control de plagas — esto es **dominio APPCC puro**, no entra en el catálogo SICTED.
- `Ins-Bas.16.For_Parte averías.doc` vs `PARTE ACCIONES CORRECTIVAS` (cód. PAC): son **dos formularios distintos** — corregido en fase 4 (ver ahí), la revisión anterior los había fusionado.
- `RPHT RESTAURANTE WARYNESSY 4.pdf`: es el **manual maestro APPCC/HACCP completo** de Warynessy (65 págs., "Requisitos Previos de Higiene y Trazabilidad" — Plan de aguas, limpieza, manipuladores, mantenimiento, plagas, residuos, trazabilidad), preparado por ICSAM. Los checklists individuales que ya he revisado son capítulos/anexos de este manual.

**No se construye ni se toca el módulo `appcc` del código en este plan** — solo el motor `checklists` compartido (fase 1-4), que queda preparado para que un futuro `appcc` lo consuma. Los datos específicos de APPCC vistos aquí (manipuladores, plagas como inspección, RPHT completo) no entran al catálogo SICTED. El RPHT sería la fuente ideal para un **plan aparte** si en el futuro se quiere rehacer/arreglar el módulo APPCC (que hoy tiene un bug de enrutado conocido, ver "Hallazgos del scout"); no se crea ese plan ahora salvo que el usuario lo pida explícitamente.

## Hallazgos del scout (verificados en el repo)

- **APPCC ya existe** (`backend/src/modules/appcc/`, 734 líneas, con tests): controles de temperatura, planes de limpieza, plagas, recepción, alertas. **Fuera de alcance.**
- **Bug ajeno detectado**: el frontend APPCC (`frontend/src/hooks/use-appcc.ts`) llama a `/v1/appcc/controls` y `/measurements`, rutas que el controlador no expone (expone `temperature-controls`, `cleaning-plans`…). Pantalla desconectada. **No se arregla aquí**; avisar al usuario.
- **Reutilizable como infraestructura** (no como dominio): `MODULE_REGISTRY` (`modules/modules/constants/registry.ts`), `SECTION_REGISTRY` (`role-access/constants/section-registry.ts`), guards (`ModuleGuard`, `SectionAccessGuard`, `@RequireModule`), `NAV_GROUPS` (`frontend/src/features/modules/lib/nav-config.ts`), `@Cron` (`compras/services/stale-partial-order-alert.service.ts:25`), `Alert` + WebSocket→campana, PDFKit (`etiquetado/services/food-label-pdf.service.ts`), patrón void+`editLog` de `FoodLabel`, `FileInterceptor` para adjuntos.
- **Ya cubierto por Chefchek para "Aprovisionamiento"**: albaranes OCR, `Lot` con caducidad, etiquetado, página de caducidades. En SICTED solo se **muestra como evidencia** (fase 6).
- **Sin equivalente hoy**: reservas/lista de espera/cobro (Chefchek no es TPV ni reservas). Recepción/servicio/facturación → solo protocolos documentados, no funcionalidad.

## Trampas conocidas que el plan ya absorbe

- Backup restore hace `DELETE FROM <tabla>` (`backup-restore.service.ts:96-100`) y purge de tenant es hard-delete en cascada (`superadmin.service.ts:50`): chocan con un trigger anti-borrado → resuelto con escape controlado + exclusión de `checklist_*`/`sicted_*` del restore por defecto (decisión confirmada, ver tabla de decisiones).
- `CHILD_SCOPE_RULES` huérfanas rompen el backup por tenant (PG 42703): **`tenantId` en todas las tablas `sicted_*`** para no necesitar reglas hijas.
- Soft-delete lo aplica una extensión Prisma (`common/services/prisma.service.ts`): las tablas `sicted_*` **no** entran (evidencia no se "papelera"). `prisma migrate dev` sin TTY: usar `migrate diff` + `migration.sql` a mano (ahí va el trigger).
- Nunca `seed` en BD con datos reales: plantillas de ejemplo por endpoint idempotente, no por script.
- UI: `globals.css` oculta `header:not(.fixed)` y `nav:not(.fixed)` (usar `<div>`/`role=tablist`); `useConfirm()` M3 (nada de `confirm()`); inputs ≥16px (iOS zoom); overlays `fixed inset-0` con `pb-28`; date inputs con `color-scheme`; tabs de modal con `useState`.
- `bun test` falla: usar `bunx jest`. e2e contra `chefchek_test` (no la BD dev). Dos Postgres en dev (brew :5432 vs docker :5433). Backend :3001 corre `dist`: build + relanzar. Verificar cwd del proceso en :3000.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Fundamentos y andamiaje](./phase-01-fundamentos-y-andamiaje.md) | Completed |
| 2 | [Motor de registros backend](./phase-02-motor-de-registros-backend.md) | Completed |
| 3 | [Registros diarios y editor de Plan UI](./phase-03-registros-diarios-y-editor-de-plan-ui.md) | Completed |
| 4 | [Mantenimiento preventivo y correctivo](./phase-04-mantenimiento-preventivo-y-correctivo.md) | Completed |
| 5 | [Pack de auditoría](./phase-05-pack-de-auditor-a.md) | Completed |
| 6 | [Proveedores y aprovisionamiento](./phase-06-proveedores-y-aprovisionamiento.md) | Completed |
| 7 | [Personas: puestos formación protocolos](./phase-07-personas-puestos-formaci-n-protocolos.md) | Completed |
| 8 | [Cliente y sostenibilidad](./phase-08-cliente-y-sostenibilidad.md) | Pending |
| 9 | [Dirección: buenas prácticas y mejora](./phase-09-direcci-n-buenas-pr-cticas-y-mejora.md) | Pending |
| 10 | [Docs y cierre](./phase-10-docs-y-cierre.md) | Pending |

Cada fase = un PR a `develop` (deploy = PR release develop→main). MVP = 1–5.

## Mapa requisitos del usuario → fases

| Bloque SICTED | Cobertura | Fase |
|---|---|---|
| Planes de higiene / registros de limpieza (Plan + Registro, doble validación, observaciones) | Motor de registros | 2–3 |
| Apertura/cierre, confort, baños (cambiador), sostenibilidad (residuos, km0) | Plantillas con `kind` distinto sobre el mismo motor | 2–3 (+8) |
| Mantenimiento preventivo/correctivo, extintores, filtros, plagas (calendario + certificados) | Activos, planes, registros, incidencias | 4 |
| Evidencia para inspecciones/auditorías | PDF de plan y de registros, cobertura, CSV | 5 |
| Homologación de proveedores, control de recepción, caducidades/FIFO | Perfil de cumplimiento + incidencias de recepción + inventario snapshot + evidencia de solo lectura | 6 |
| Formación anual, fichas de puesto, estándares de imagen | Plan formativo, puestos, protocolos con acuse | 7 |
| Quejas, sugerencias, satisfacción | Registro con respuesta y cierre | 8 |
| Legalidad, objetivos, autoevaluación, plan de mejora, participación | Catálogo de 109 prácticas (escala 1/3/4/5/NA), acciones de mejora | 9 |
| Recepción/reservas/espera, cobro, cartas en idiomas | **Fuera de software**: protocolos (fase 7); cartas multi-idioma ya existen (evidencia) | — |

## Criterios de aceptación globales

- [ ] `appcc` y sus tablas intactos; `git diff` sin cambios en `backend/src/modules/appcc/` ni `frontend/src/app/dashboard/appcc/`.
- [ ] Ninguna marca de registro puede editarse/borrarse por API ni por SQL de aplicación (test con Postgres real).
- [ ] Cada marca guarda hora de servidor, cuenta de sesión y persona real; las hojas `mode=INSPECTION` (y `MEASUREMENT` si el tenant lo activa) llevan validación de supervisor una sola vez — `EXECUTION` no la requiere (ningún documento real de ejecución diaria la lleva).
- [ ] Tenant A nunca ve/escribe datos de tenant B (tests de aislamiento en todos los endpoints).
- [ ] Backup/restore por tenant funciona con las tablas nuevas (sin 42703).
- [ ] Módulo desactivado por defecto; con módulo off, API 403 y nav oculta.
- [ ] Un mes de registros exporta a PDF legible con firmas y observaciones.

## Fuera de alcance (explícito)

Integración con plataforma oficial SICTED · reservas/TPV · tool del Asistente IA para SICTED · modo offline/PWA de la tablet (confirmado innecesario: siempre hay wifi en cocina) · hash-chain criptográfico · tocar APPCC.

## Preguntas abiertas

**Todas resueltas (2026-09-23/24)** — ver tabla "Decisiones de producto" para el detalle. Sin preguntas bloqueantes pendientes; el plan puede pasar a validación/red-team/implementación.

1. ~~Manual vigente~~ → confirmado, `BBPP_Restaurantes_y_empresas_turisticas_de_Catering.pdf` (2024).
2. ~~Supervisor~~ → rol ADMIN/OWNER, sin flag nuevo.
3. ~~Cuenta compartida~~ → selector de persona sin PIN.
4. ~~Restore~~ → `checklist_*`/`sicted_*` excluidas por defecto.
5. ~~Protocolos narrativos~~ → Wiki + acuse versionado.
6. ~~Quejas por QR público~~ → no, solo captura interna.
7. ~~Tablet offline~~ → wifi siempre disponible, sin cola offline.
8. ~~Km 0~~ → checklist manual, sin tocar Proveedores.
9. ~~Complementarios/avanzados~~ → Eventos + Servicio en barra; sí se persiguen los avanzados (RSC, Diversidad funcional, Innovación).

## Validation Log

### Session 1 — 2026-09-24
**Trigger:** `/ck:plan validate` tras cerrar las 8 preguntas de producto; usuario pidió "prosigue" tras la última confirmación.
**Questions asked:** 4

#### Verification Results
- **Tier:** Full (10 fases)
- **Claims checked:** 23
- **Verified:** 23 | **Failed:** 0 | **Unverified:** 0

Claims verificadas (Fact Checker + Contract Verifier): patrón de guards de `appcc.controller.ts` (`@UseGuards`/`@RequireModule`/`@RequireSection`), `MODULE_REGISTRY`/`SECTION_REGISTRY`/`NAV_GROUPS` exports, `ModuleGuard`/`SectionAccessGuard` existen, `@Cron` en `stale-partial-order-alert.service.ts`, campos `Stock.quantity/minimumStock/maximumStock/reorderLevel`, `Supplier.sanitaryRegistry`, modelo `Lot`, `FoodLabel.voidedAt/editLog`, extensión soft-delete de `PrismaService`, `EXCLUDED_TABLES`/`GLOBAL_ONLY_TABLES`/`CHILD_SCOPE_RULES` de `backup.constants.ts`, `DELETE FROM` en `backup-restore.service.ts`, comentario de purge en `superadmin.service.ts`, modelos `KnowledgeArticle`/`KnowledgeVersion`, `backend/test/setup.ts`, plan `260831-0031-uploads-auth-tenant-scoped`, `AuthGuard`/`TenantGuard`/`RolesGuard`, `FileInterceptor` en `products.controller.ts`, PDFKit en `food-label-pdf.service.ts`, test helper `pdfText()`, commit `3c535bf`, directorios de módulo `technical-sheets`/`escandallos`/`etiquetado`/`albaranes`.

Ninguna cita falló. Como efecto colateral de la relectura, se detectaron y corrigieron 2 contradicciones internas de `plan.md` (texto de "Hallazgos del manual oficial" y de "Carpeta APPCC" que aún citaban la decisión superada "SICTED nunca depende de APPCC activo" en vez de la decisión final "motor de checklist compartido") — ver Whole-Plan Consistency Sweep abajo.

#### Questions & Answers

1. **[Assumption]** El documento real de temperaturas (`Ficha-Comprobación Temperaturas`) solo tiene una firma por fila, a diferencia de la revisión de limpieza que lleva doble firma. ¿Las hojas `MEASUREMENT` llevan validación de supervisor por defecto?
   - Options: No, sin supervisor por defecto (Recomendado) | Sí, con supervisor por defecto
   - **Answer:** No, sin supervisor por defecto.
   - **Rationale:** `requiresSupervisor` de fase 2 no distinguía `MEASUREMENT` explícitamente de `EXECUTION`; ahora los dos comparten default `false`, fiel al documento real (una sola firma).

2. **[Assumption]** Sin PIN, el selector "¿Quién?" se recuerda para toda la hoja. ¿Suficiente, o hay que re-preguntar en cada marca?
   - Options: Una vez por hoja (Recomendado, diseño actual) | En cada marca individual
   - **Answer:** Una vez por hoja.
   - **Rationale:** Confirma el diseño ya escrito en fase 3 sin cambios; menos fricción, evidencia igual de fuerte que preguntar más veces dado que no hay PIN.

3. **[Scope]** Las 109 prácticas del catálogo SICTED: ¿se siembran solas al activar el módulo, o requieren botón explícito?
   - Options: Automático al activar el módulo (Recomendado) | Botón explícito "Cargar catálogo"
   - **Answer:** Botón explícito "Cargar catálogo".
   - **Rationale:** El usuario prefirió control explícito frente a la recomendación de cero-fricción — deja margen para elegir versión de manual en el futuro sin sembrar de más. Cambia fase 9 (implementation step 3, related code files) y `plan.md`.

4. **[Risk]** Si se desactiva `sicted`, el motor compartido `checklists` queda sin nav propia — ¿aceptable que sus datos queden temporalmente inaccesibles hasta reactivar?
   - Options: Sí, igual que el resto de módulos (Recomendado) | No, necesito verlos aunque SICTED esté apagado
   - **Answer:** Sí, igual que el resto de módulos.
   - **Rationale:** Confirma el diseño de fase 1 (sin entrada propia en `MODULE_REGISTRY` para `checklists`) sin cambios.

#### Confirmed Decisions
- Supervisión en `MEASUREMENT`: no, por defecto — fase 2.
- Granularidad del selector de persona: una vez por hoja — sin cambio, fase 3.
- Sembrado del catálogo de fase 9: botón explícito "Cargar catálogo", no automático — fase 9, `plan.md`.
- Desactivación de `sicted` oculta datos de `checklists` como cualquier otro módulo — sin cambio, fase 1.

#### Action Items
- [x] Fase 2: `requiresSupervisor` default explícito para `MEASUREMENT=false`.
- [x] Fase 3: nota de "sin validación por defecto" en la UX de `mode=MEASUREMENT`.
- [x] Fase 9 + `plan.md`: sembrado del catálogo vía botón explícito, no automático.
- [x] `plan.md`: corregidas 2 referencias a la decisión superada "SICTED nunca depende de APPCC activo".

#### Impact on Phases
- Fase 2: `requiresSupervisor` default aclarado para los 3 modos.
- Fase 3: UX de `MEASUREMENT` explícita sobre la ausencia de supervisor.
- Fase 9: paso de implementación y "Related Code Files" actualizados con el botón "Cargar catálogo".
- `plan.md`: 2 contradicciones internas corregidas (Hallazgos del manual oficial, Carpeta APPCC), catálogo aclarado como sembrado manual.

### Whole-Plan Consistency Sweep
- Files reread: `plan.md`, todas las `phase-*.md` (10).
- Decision deltas checked: 4 (supervisión MEASUREMENT, granularidad selector, sembrado catálogo, desactivación módulo) + 2 deltas heredadas de sesiones anteriores detectadas en esta relectura (decisión "SICTED nunca depende de APPCC" superada por "motor compartido", aún citada en 2 sitios).
- Reconciled stale references: 6 (`requiresSupervisor` en fase 2, `mode=MEASUREMENT` en fase 3, sembrado en fase 9 ×2, `plan.md` "Hallazgos del manual oficial", `plan.md` "Carpeta APPCC").
- Unresolved contradictions: 0.

## Recomendación

Verificación 23/23, 0 fallos. Sin contradicciones sin resolver. **Elegible para implementación** (`/ck:cook`).

## Registro de implementación

### Fase 1 — 2026-09-24, rama `feat/sicted-fase-1-fundamentos`

Completada. `MODULE_REGISTRY`/`SECTION_REGISTRY` con `sicted`; módulo neutro `ChecklistsModule` (vacío, sin controlador, listo para fases 2/4); `SictedModule`/`SictedController` con el guard stack completo y un `GET /ping` temporal; nav "Calidad"; migración `immutability_guard` (funciones `forbid_mutation`/`forbid_mutation_after_seal`, sin tablas aún); exclusión de `checklist_*`/`sicted_*` del restore por defecto con escape explícito `includeEvidenceTables`.

**Hallazgos de implementación** (no estaban en el plan, corregidos sobre la marcha):
- `AuthGuard` exige importar `AuthModule` en el módulo consumidor aunque `GuardsModule` sea global — coherente con la nota ya existente en memoria del proyecto, pero se me olvidó aplicarla al escribir `sicted.module.ts` la primera vez; el e2e lo detectó.
- La BD dev local (`:5432`, clon de producción, 9 tenants) no tenía tabla `_prisma_migrations` — bloqueo preexistente, no causado por esta fase. Resuelto con `prisma migrate resolve --applied` (61 migraciones, solo contabilidad, sin tocar datos; verificado recuento de tenants/usuarios antes/después).
- Bug propio encontrado en revisión: implementé el filtro de exclusión de evidencia en el restore pero olvidé activar el escape `SET LOCAL` para el caso `includeEvidenceTables=true` — se habría bloqueado contra su propio trigger en cuanto existieran tablas reales. Corregido y cubierto con un test de integración contra Postgres real.

**Tests**: 132 suites/1991 tests unitarios (sin regresiones) + 3 suites e2e nuevas (12 tests) contra `chefchek_test`. `tsc --noEmit` limpio en backend y frontend.

**Revisión**: subagentes bloqueados por un fallo de infraestructura (tmux) durante toda la sesión — revisión hecha inline por el agente principal, con el visto bueno del usuario, siguiendo el mismo checklist que se le pediría a `code-reviewer`.

**Pendiente de commit**: cambios en staged, a la espera de confirmación del usuario.

### Fase 2 — 2026-09-24, rama `feat/sicted-fase-2-motor-registros` (sobre `feat/sicted-fase-1-fundamentos`)

Completada. Modelos `ChecklistTemplate`/`ChecklistTemplateItem`/`ChecklistRun`/`ChecklistEntry` (migración `checklist_engine`, con los triggers de inalterabilidad de fase 1 adjuntos a `checklist_entries`/`checklist_runs`); `checklist-period.util.ts` (periodos Europe/Madrid, semana ISO, 20 tests); servicios de plantillas y hojas en `ChecklistsModule` (versionado, siembra idempotente compartida por `externalCode`, generación idempotente por periodo, marcas por modo EXECUTION/INSPECTION/MEASUREMENT, corrección con histórico, supervisión); `ChecklistRunSchedulerService` (cron diario, alertas por hoja vencida); `SictedChecklistController` con la superficie completa de la tabla API; 3 plantillas iniciales reales (Comprobación de Temperaturas RE 4-2, Limpieza de cocina, Revisión semanal de limpieza RE 2-1).

**Hallazgos de implementación** (no estaban en el plan, corregidos sobre la marcha):
- Bug de autorización propio, encontrado por el test HTTP: 5 rutas (`GET runs/today`, `GET runs`, `GET runs/:id`, `POST runs/:id/entries`, `GET performers`) no tenían `@Roles`, así que cualquier rol autenticado —incluido VIEWER— podía marcar y ver hojas, violando la tabla de la API ("USER+") y el criterio de aceptación explícito ("VIEWER no marca"). Corregido con `@Roles("USER")` en las 5 (la jerarquía de `RolesGuard` ya deja pasar a ADMIN/OWNER/SUPERADMIN por encima).
- `seedStarter`: el camino de "ya sembrada"/"añadir módulo" devolvía la plantilla sin `items` (inconsistente con `create`/`update`, que sí los incluyen). Corregido añadiendo el mismo `include`.
- `Alert` no tiene columna de módulo (hallazgo de fase 1 que se hereda aquí): una hoja vencida genera **una** alerta, no una por módulo consumidor activo, documentado en el propio scheduler.

**Tests**: 133 suites/2011 tests unitarios (sin regresiones) + 11 suites e2e (66 tests) contra `chefchek_test`, incluida la nueva `sicted-checklist-controller.e2e-spec.ts` (HTTP real, guards de auth/tenant/rol/módulo/sección) que fue la que encontró el bug de autorización de arriba. `tsc --noEmit` limpio.

**Revisión**: subagentes seguían bloqueados (mismo fallo de tmux de fase 1, no reintentado) — revisión hecha inline por el agente principal, mismo criterio aprobado en fase 1.

**Pendiente**: red-team completo del plan (las 4 lentes adversariales) sigue diferido por el usuario, no solo para esta fase. Rama fase 2 apilada sobre fase 1 sin fusionar — el orden de fusión a `develop` debe respetar esa dependencia.

**Pendiente de commit**: cambios sin confirmar, a la espera del usuario.

### Fase 3 — 2026-09-25, rama `feat/sicted-fase-3-editor-plan` (sobre `develop`, ya con fases 1-2 fusionadas)

Completada. Hub (`/dashboard/sicted`, tarjetas de progreso por área + pendientes de validar + vencidas), "Hoy" (maestro-detalle en una sola ruta, sin ruta extra por hoja), editor de Plan (crear/editar/archivar plantillas e ítems), Registros (matriz mensual filas=ítems/columnas=periodos con detalle por celda), detalle solo lectura de hoja (`registros/[runId]`). Checklist adaptado a los 3 modos (EXECUTION/INSPECTION/MEASUREMENT), selector "¿Quién?" sin PIN, corrección con motivo, validación con `useConfirm()` M3.

**Hallazgos de implementación** (no estaban en el plan, encontrados y corregidos por verificación real en navegador, no solo tsc/build):
- Bug de progreso: el contador "X/Y" del hub/lista usaba nº de filas de `checklist_entries`, no de ítems distintos — una corrección (que añade una fila sin añadir un ítem nuevo) inflaba el progreso por encima del total (ej. "3/9" con solo 2 ítems realmente marcados). Corregido en el backend con un conteo de ítems distintos (`groupBy` por `(runId,itemId)`, no `_count` de filas); cubierto con un test de regresión dedicado.
- El motivo/observación/acción correctiva de una marca no se mostraba una vez bloqueada (ni en la vigente ni en el histórico) — justo la evidencia que el auditor necesita ver. Corregido mostrando el detalle relevante bajo la marca vigente y en cada entrada del histórico.
- Tras validar una hoja, el botón "Corregir" seguía apareciendo aunque el backend rechaza cualquier marca/corrección nueva sobre una hoja validada (409) — confuso, el usuario lo intentaría y fallaría. Corregido bloqueando también en cliente (`locked = readOnly || !!run.supervisedAt`) en vez de depender solo del backend para la UX.

**Tests**: 133 suites/2011 tests unitarios backend + 11 suites/67 tests e2e backend (incluido el nuevo test de regresión de `entriesCount`) sin regresiones. Frontend: `tsc --noEmit` y `eslint` limpios, `next build` genera las 5 rutas nuevas sin errores. Verificación E2E manual en navegador real (Chrome, login real, guard stack completo) contra un tenant de prueba desechable (`sicted-browser-test`, creado y borrado en la BD de dev — nunca se tocó el tenant real de Warynessy ni ningún otro; recuento de tenants/usuarios verificado idéntico antes/después: 9/10): siembra de plantillas de ejemplo, marcar EXECUTION con motivo obligatorio, corrección con histórico, flujo INSPECTION completo (marcar 10/10 → Guardar → Validar → diálogo M3 → hoja bloqueada), matriz mensual con datos reales, modo claro/oscuro.

**Revisión**: subagentes seguían bloqueados (mismo fallo de tmux) — revisión hecha inline; en este caso la revisión más valiosa fue la propia verificación en navegador, que encontró 2 bugs reales que ni tsc ni los tests automatizados existentes podían atrapar (ambos son de UI/agregación, no de la API en sí).

**Pendiente**: red-team completo del plan sigue diferido por el usuario. Documentos reales adicionales del "Plan de limpieza y desinfección" prometidos por el usuario siguen sin llegar — las 3 plantillas iniciales son representativas, no exhaustivas.

**Pendiente de commit**: cambios sin confirmar, a la espera del usuario.

### Fase 4 — 2026-09-25, rama `feat/sicted-fase-4-activos-mantenimiento` (sobre `develop`, con fases 1-3 ya fusionadas)

Completada. Modelos `ChecklistAsset`/`ChecklistMaintenancePlan`/`ChecklistMaintenanceRecord` (append-only)/`ChecklistIncident` (hitos null→valor, trigger nuevo `forbid_milestone_rewrite`); servicios de equipos/planes/registros/incidencias; adjuntos privados (zona Bunny sin Pull Zone o disco fuera de `uploads/`, nunca estático); `SictedMaintenanceController`; cron de avisos a 30 días/vencido; UI con 3 pestañas (Calendario, Equipos, Averías) — los dos formularios reales (Ins-Bas.16 y PAC) con correlativo "Parte Nº" y línea de tiempo de hitos.

**Hallazgos de implementación** (no estaban en el plan, encontrados y corregidos por verificación real en navegador):
- El `status` (OPEN/NOTIFIED/RESOLVED) de una incidencia nunca avanzaba al marcar hitos o resolver — la insignia se quedaba en "Abierta" para siempre aunque `resolvedAt` estuviera puesto. Corregido enviando `status` junto al hito correspondiente.
- El cron de avisos de mantenimiento no comprobaba si el módulo seguía activo (a diferencia del scheduler de hojas de fase 2, que sí lo hace) — un tenant que desactivara `sicted` seguiría recibiendo campanas de sus equipos. Corregido con el mismo criterio que fase 2; cubierto con un test dedicado (antes sin cobertura alguna).

**Tests**: 134 suites/2020 tests unitarios backend + 14 suites/90 tests e2e backend (incluidos el motor de mantenimiento, el controlador HTTP con adjuntos, y el recordatorio con las 4 combinaciones vencida/próxima/lejana/módulo-desactivado) sin regresiones. Frontend: `tsc --noEmit`, `eslint` y `next build` limpios (2 rutas nuevas: `/mantenimiento` y sus 3 pestañas en una sola ruta). Verificación manual en Chrome contra un tenant de prueba desechable (creado y borrado en la BD de dev, nunca se tocó Warynessy; recuento de tenants/usuarios verificado idéntico antes/después: 9/10): siembra de extintores (equipo+plan), registro de revisión con recálculo de fecha, avería completa con los 4 hitos, PAC completa con correlativo y resolución, modo claro/oscuro.

**Revisión**: subagentes no disponibles, revisión inline — igual que fase 3, la verificación en navegador encontró los bugs reales (2 esta vez), no la lectura de código.

**Pendiente**: red-team del plan completo sigue diferido por el usuario. Documentos reales adicionales prometidos por el usuario siguen sin llegar.

**Pendiente de commit**: cambios sin confirmar, a la espera del usuario.

### Fase 5 — 2026-09-25, rama `feat/sicted-fase-5` (sobre `develop`, con fases 1-4 ya fusionadas)

Completada. Cobertura ("¿qué falta?", reutiliza `isGenerationDay` de fase 2 para que "esperado" nunca se desincronice del cron real), 3 PDFs deterministas (Plan por área, cuadrante mensual con huella SHA-256, calendario+libro de averías anual) sobre PDFKit siguiendo el patrón de `food-label-pdf.service.ts`, CSV de marcas, y la pantalla `/dashboard/sicted/auditoria` con descargas iOS-safe (patrón `window.open` síncrono ya verificado en iPhone real para fichas técnicas/fase 4).

**Hallazgos de implementación** (no estaban en el plan, encontrados y corregidos por verificación real — dos vía test automatizado, uno vía inspección visual del PDF descargado):
- Los símbolos ✓/✗ no renderizaban en el PDF: la fuente Helvetica estándar (WinAnsi) no tiene esos glifos, salían como carácter roto. Cazado al inspeccionar visualmente el PDF descargado (el test automatizado con `pdfText()` tenía una aserción equivocada que no lo habría detectado). Corregido a "OK"/"NO".
- El límite `to` de un rango de cobertura se trataba como inclusivo por el desfase horario Madrid/UTC (`to` a medianoche UTC ya es el día siguiente en Madrid) — colaba un día de más como "esperado". Cazado por un test de cobertura que fallaba de forma no obvia; corregido comparando por instante en vez de por día natural derivado de `to`.
- El panel de cobertura marcaba como "hueco" los días futuros del mes en curso (pedir cobertura de todo septiembre a mitad de mes marcaba el 21-30 como "sin generar", aunque todavía no les tocaba). Cazado en navegador real con datos sembrados a propósito; corregido topando el rango efectivo en `now`.

**Tests**: 134 suites/2020 tests unitarios backend (sin cambios, esta fase es toda e2e) + 16 suites/103 tests e2e backend (motor de auditoría: cobertura, huella determinista, CSV — 7 tests nuevos; controlador HTTP: roles + smoke de los 5 endpoints — 5 tests nuevos) sin regresiones. Frontend: `tsc --noEmit`, `eslint`, `next build` limpios (`/dashboard/sicted/auditoria`). Verificación manual en Chrome contra un tenant de prueba desechable con datos reales sembrados (15 ítems × 18 días, con huecos deliberados): descarga de los 4 tipos de PDF/CSV confirmada (blob autenticado + apertura en pestaña nueva), panel de cobertura con huecos exactos, y el PDF del cuadrante mensual descargado con `curl` y leído página a página — 1 sola página, totalmente legible. Nunca se tocó Warynessy; recuento de tenants/usuarios verificado idéntico antes/después (9/10).

**Revisión**: subagentes no disponibles, revisión inline. Dos de los tres hallazgos vinieron de escribir tests de verdad contra Postgres real (no de la revisión de código); el tercero (glifos rotos) solo se vio al mirar el PDF de verdad, no al leer el código que lo genera — ningún test automatizado lo habría cazado sin decodificar y comparar el texto exacto, que es justo lo que hice después de verlo roto.

**Pendiente**: red-team del plan completo sigue diferido por el usuario. Fases 6-10 pendientes; fase 6 es la siguiente según el plan.

**Pendiente de commit**: cambios sin confirmar, a la espera del usuario.

### Fase 6 — 2026-09-25, rama `feat/sicted-fase-6` (sobre `develop`, con fases 1-5 ya fusionadas)

Completada. Rediseño confirmado en el propio plan (sin "evaluación 1-5" inventada): modelos nuevos solo para lo que el manual pide y ningún módulo existente ya cubre — `SictedSupplierComplianceProfile` (PROV.1, upsert por proveedor, **no** append-only, a diferencia del resto del módulo), `SictedSupplierIncident` (PROV.3, incidencias de recepción, append-only con `resolution`/`resolvedAt` solo null→valor vía `forbid_milestone_rewrite` reutilizada de fase 4), `SictedInventorySnapshot` (PROV.7, foto+firma de `Stock` en un instante, append-only puro). Servicio de evidencia de solo lectura (`SictedProcurementEvidenceService`) agregando recepciones confirmadas/lotes con caducidad próxima/etiquetas emitidas/stock fuera de rango sin escribir en `albaranes`/`etiquetado`/`almacenes`/`proveedores`. `registry.ts`: `sicted` ahora depende de `proveedores`. UI `/dashboard/sicted/proveedores` con 4 pestañas (Perfil de cumplimiento, Incidencias, Inventario, Evidencia).

**Hallazgos de implementación** (no estaban en el plan, encontrados y corregidos por verificación real en navegador):
- Bug propio en el formulario de incidencia: el selector de "albarán reciente" usaba `useAlbaranes({limit: 0})` para desactivarlo antes de elegir proveedor, pero `listAlbaranes` trata `0` como falsy (`if (filters.limit)`) y omite el parámetro — la API caía a su límite por defecto (20) y el desplegable listaba albaranes de **todos** los proveedores del tenant, no ninguno. Corregido con un `supplierId` centinela inexistente en vez de `limit:0`.
- Segundo bug propio, más de fondo, encontrado al verificar el primer arreglo en el navegador: `useAlbaranes` guarda su filtro en un `useState` que solo lee el argumento en el **montaje** — llamarlo de nuevo en cada render con un `supplierId` distinto (el patrón que usé) nunca lo actualiza, así que el desplegable de "albarán reciente" se quedaba vacío para siempre tras elegir proveedor, aunque la petición HTTP correcta sí llegaba a la API con éxito (confirmado con `read_network_requests`: 200 con los datos correctos, pero la UI nunca los mostraba). `useAlbaranes` está diseñado para pantallas de listado/paginación con sus propios setters, no como hook reactivo a props — sustituido por un `useQuery` directo con `listAlbaranes` y `queryKey` que sí reacciona a `form.supplierId`.

**Tests**: 134 suites/2020 tests unitarios backend (sin cambios) + 17 suites/110 tests e2e backend (7 nuevos: upsert idempotente de cumplimiento, `resolution` no reescribible, snapshot de nombre de proveedor persiste tras archivar el proveedor, `albaranId` de otro tenant rechazado, snapshot de inventario congelado aunque `Stock` cambie después, snapshot append-only, evidencia = consulta manual sobre fixtures con aislamiento de tenant) sin regresiones. Frontend: `tsc --noEmit`, `eslint` y `next build` limpios (ruta nueva `/dashboard/sicted/proveedores`, 4 pestañas). Verificación manual en Chrome contra un tenant de prueba desechable (proveedor + artículo con stock bajo mínimo + albarán confirmado con lote): perfil de cumplimiento (upsert con tristate + certificación), incidencia de recepción con selector de albarán reciente funcionando tras el segundo arreglo, resolución de incidencia (bloqueo de reescritura confirmado en el backend por el trigger), generación de inventario con desglose bajo-mínimo correcto, panel de evidencia con los 4 agregados coincidiendo con los datos sembrados. Nunca se tocó Warynessy; recuento de tenants/usuarios verificado idéntico antes/después (9/10). `git diff` no toca `albaranes`/`etiquetado`/`almacenes`/`proveedores` (confirmado con `git diff --stat`).

**Revisión**: subagentes no disponibles, revisión inline. Los dos bugs de esta fase son un ejemplo claro de por qué la verificación en navegador es obligatoria y no opcional en este proyecto: el primero (parámetro `limit:0` ignorado) era invisible en `tsc`/build/lint; el segundo (hook no reactivo) incluso pasó una comprobación superficial en DOM (el `<select>` mostraba el valor correcto) y solo se detectó al verificar el efecto de extremo a extremo (petición HTTP correcta pero UI vacía) — una revisión de código sin ejecutar la app difícilmente lo habría atrapado, porque el patrón (`useState` que ignora props tras el montaje) es sutil y el propio hook nunca advierte de esa limitación.

**Pendiente**: red-team del plan completo sigue diferido por el usuario. Fases 7-10 pendientes; fase 7 es la siguiente según el plan.

**Pendiente de commit**: cambios sin confirmar, a la espera del usuario.

### Fase 7 — 2026-09-25, rama `feat/sicted-fase-7` (sobre `develop`, con fases 1-6 ya fusionadas)

Completada (salvo un ítem diferido, ver abajo). Bloque Personas: fichas de puesto (`SictedJobProfile`/`SictedJobAssignment`, editables, no append-only — asignar cierra automáticamente la asignación vigente anterior de esa persona, nunca se borra historial), plan anual de formación (`SictedTrainingPlan`/`SictedTrainingAction`/`SictedTrainingAttendance`, asistencia append-only con certificado opcional compartido por todo el lote, cobertura de los 4 temas mínimos del manual), protocolos con acuse versionado (`SictedProtocol`/`SictedProtocolAck`, `version` propia que solo sube al publicar contenido nuevo — editar metadatos no invalida acuses —, acuse append-only con índice único `(protocolId, protocolVersion, userId)`). `/dashboard/sicted/personas` con 3 pestañas; "Mis protocolos pendientes" integrado en la pestaña Protocolos en vez de una ruta aparte (mismo resultado para el usuario, menos superficie).

**Hallazgos de implementación** (no estaban en el plan, encontrados y corregidos por verificación real en navegador):
- Bug propio en `recordAttendanceBatch`: usar `upsert` para "reenviar el mismo lote no falla" habría generado `INSERT ... ON CONFLICT DO UPDATE` a nivel SQL, y el trigger `forbid_mutation` bloquea esa rama UPDATE — el reintento del lote habría fallado con un error de Postgres. Corregido antes de probar en navegador (detectado en revisión de la propia lógica, no en runtime): `createMany` + `skipDuplicates` en su lugar, que solo hace `INSERT ... ON CONFLICT DO NOTHING`, sin tocar el trigger.
- Bug propio real, encontrado en navegador: `CreateTrainingActionDto.plannedDate` solo llevaba `@Type(() => Date)` (class-transformer) sin ningún decorador de `class-validator` — `ValidationPipe({whitelist:true, forbidNonWhitelisted:true})` (config global del proyecto) determina qué propiedades "existen" a partir de la metadata de `class-validator`, no de `class-transformer`; sin `@IsDate()`, la propiedad no se registraba y cada intento de crear una acción formativa fallaba con `property plannedDate should not exist`. Corregido añadiendo `@IsDate()`; verificado que el resto de campos `Date` de la fase (en `sicted-protocol.dto.ts`, `sicted-supplier-compliance.dto.ts` de fase 6) sí llevaban el decorador completo.

**Tests**: 134 suites/2020 tests unitarios backend (sin cambios) + 18 suites/118 tests e2e backend (8 nuevos: asignar cierra la asignación anterior, asistencia no reescribible, reenviar el mismo lote es no-op seguro, cobertura de temas distingue cubierto/pendiente, nueva versión de protocolo deja pendiente de nuevo a quien ya había acusado, acuse duplicado rechazado, editar metadatos no invalida acuses, matriz no expone datos de otro tenant) sin regresiones. Frontend: `tsc --noEmit`, `eslint`, `next build` limpios (ruta nueva `/dashboard/sicted/personas`, 3 pestañas). Verificación manual en Chrome contra un tenant de prueba desechable (OWNER + un USER de plantilla): ficha de puesto creada y persona asignada, plan de formación 2026 creado, acción sobre alérgenos creada y marcada hecha (cobertura pasó de "Pendiente" a "Cubierto"), asistencia registrada en lote, protocolo creado y acusado (matriz reflejó el acuse), nueva versión publicada e invalidó el acuse correctamente (protocolo volvió a "Mis pendientes", matriz volvió a "—"). Nunca se tocó Warynessy; recuento de tenants/usuarios verificado idéntico antes/después (9/10). `git diff --stat` contra `appcc` sin salida.

**Alcance diferido**: Implementation Step 5 (exportables al pack de auditoría — PDF de fichas de puesto, plan formativo con asistencia, matriz protocolo×empleado) no se implementó en este pase; ninguno de los 3 criterios de éxito de la fase lo requiere. Documentado explícitamente en `phase-07-*.md` en vez de darlo por hecho.

**Revisión**: subagentes no disponibles, revisión inline. Un bug (upsert vs. createMany+skipDuplicates) se atrapó razonando sobre el propio diseño del trigger antes de tocar el navegador; el otro (`plannedDate` sin `@IsDate()`) solo se vio al intentar crear una acción de verdad — ni `tsc` ni `eslint` lo señalan porque el campo es sintácticamente válido, el problema es puramente de metadata en tiempo de ejecución de `class-validator`.

**Pendiente**: red-team del plan completo sigue diferido por el usuario. Fases 8-10 pendientes; fase 8 es la siguiente según el plan.

**Pendiente de commit**: cambios sin confirmar, a la espera del usuario.
