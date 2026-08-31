---
title: >-
  Etiquetado de alimentos con trazabilidad (platos elaborados y artículos
  manipulados)
description: >-
  Módulo `etiquetado`: emisión + histórico re-imprimible de etiquetas de cocina
  para platos elaborados (receta) y artículos manipulados/reenvasados
  (artículo). Lote autogenerado, cálculo de consumo preferente, selección manual
  de lotes de ingredientes, PDF térmica + A4, QR a la ficha de trazabilidad.
status: done
priority: P2
branch: feat/etiquetado-alimentos
tags:
  - backend
  - frontend
  - prisma
  - etiquetado
  - trazabilidad
  - appcc
  - pdf
  - qr
blockedBy: []
blocks: []
created: '2026-08-31T00:39:00.000Z'
createdBy: 'ck:plan'
source: skill
---

# Etiquetado de alimentos con trazabilidad

## Overview

Sistema tipo yurest.com para imprimir etiquetas de los alimentos que la cocina procesa y conserva:

- **Plato elaborado** (ej. *Jarrete*, receta existente en Recetas): etiqueta con fecha/hora de elaboración, consumo preferente calculado, lote de producción autogenerado, condición de conservación, alérgenos, responsable, y **lotes de los ingredientes usados** (elegidos a mano al etiquetar).
- **Artículo manipulado/reenvasado** (ej. *Lubina* de Mar Menor, *lomo de añojo* de Makro): etiqueta con fecha de recepción/compra, lote del proveedor (del albarán → modelo `Lot` ya existente), caducidad original del fabricante, fecha de manipulación, consumo preferente secundario calculado, conservación, responsable.

Cada etiqueta emitida se **persiste** (`FoodLabel`) como registro de trazabilidad consultable y re-imprimible; anulable pero no borrable. La etiqueta lleva **lote en texto grande + QR** que abre la ficha de trazabilidad.

Base ya existente que se reutiliza (ver reporte de scout): modelo `Lot` (1 por línea de albarán, con `expiryDate` reservado), `LotService.findLots()`, `technical-sheets.service.ts` (patrón pdfkit), módulo `qr`, guards `ModuleGuard`/`SectionAccessGuard` + `@RequireModule` (plantilla: `sala-tasks`).

## Decisiones de producto (confirmadas con el usuario, 2026-08-31)

| Tema | Decisión |
|---|---|
| Formato de impresión | **Ambos**: PDF térmica (rollo 57 mm y 100 mm, 1 etiqueta/página) **y** PDF A4 con rejilla de etiquetas. Selector de plantilla + nº de copias al imprimir. |
| Persistencia | **Histórico completo**: cada etiqueta emitida se guarda (qué, lote, lotes de ingredientes, fechas, quién). Re-imprimible. Anular = soft (`voidedAt`), nunca borrar. |
| Lotes de ingredientes (plato elaborado) | **Selección manual al etiquetar**: la app lista los ingredientes de la receta y el cocinero confirma qué lote usó de cada uno (de los `Lot` disponibles), con opción "sin especificar" / texto libre. Preselecciona el último lote conocido. |
| Vida útil / conservación | **Configurable por receta y por artículo** (columnas nuevas nullable) + **editable puntualmente** al imprimir. Sin fallback por categoría en v1. |
| Punto de entrada | **Módulo propio** `/dashboard/etiquetado` (crear + histórico) **y** botón "Etiquetar" en la ficha de cada Receta y Artículo (deep-link con entidad preseleccionada). |
| Vínculo con Producción | Se etiqueta **suelto desde la receta**. Vínculo opcional a `ProductionOrder` completada. Módulo Producción **no** es prerequisito. |
| QR | **QR + texto**: la etiqueta muestra el lote legible en grande **y** un QR que abre `/e/{qrToken}` — **ficha pública de solo lectura, SIN login** (`qrToken` opaco tipo cuid, no enumerable). Muestra ficha completa (producto, lote, fechas, conservación, alérgenos, lotes de ingredientes) **excepto el nombre del responsable**, que en la vista pública sale como iniciales/rol (el registro interno sí lo guarda). |
| Base de rama | El plan se creó sobre `feat/recipe-yield-weight-anchor` (schema + recipes/* sin commitear + migración `20260831095709`). **Etiquetado NO se implementa hasta que esa rama entre en `develop`**; entonces se crea rama nueva desde `develop` limpio. `status: blocked`. |
| Vínculo con Producción (v1) | `FoodLabel.productionOrderId` se crea en BD para el futuro **pero NO hay picker en la UI de v1** (YAGNI). El DTO de creación puede aceptarlo a nivel de API, el formulario no lo envía. |
| Grupo de menú | **Seguridad / APPCC**. |
| Formato de lote (plato elaborado) | `PREFIJO-DDMMAA-NN` — prefijo 3–4 letras del nombre de la receta (mayúsculas, sin acentos) + fecha **día-mes-año** + secuencia diaria por tenant. Ej. `JARR-310826-01`. |

## Alcance

**Dentro:**
- Módulo `etiquetado` (backend + frontend), gateado por tenant (`MODULE_REGISTRY`, `defaultEnabled: false`) y por rol (`SECTION_REGISTRY`).
- Modelos `FoodLabel` + `FoodLabelIngredientLot` (aditivos). Columnas de conservación nullable en `Recipe` y `Product`.
- Generador de nº de lote diario por tenant.
- Cálculo de `useByDate` / `frozenUseByDate`.
- PDF: 3 presets (térmica 57, térmica 100, A4 rejilla) con pdfkit + QR embebido.
- Frontend: listado (paginado server-side), alta de etiqueta (2 flujos), detalle, re-impresión, anulación, ficha de trazabilidad por QR, config de conservación en modales de Receta y Artículo, botones "Etiquetar".
- Docs (`docs/`) + entrada en `nav-config`.

**Fuera (YAGNI, se menciona como futuro):**
- Consumo/decremento real de stock por lote al etiquetar (sigue siendo responsabilidad de Producción/Almacenes; aquí solo se registra qué lote se declaró).
- Integración con partes de cumplimiento APPCC (`compliance-reports`).
- Tool del asistente IA para consultar etiquetas.
- Drill-down de lotes en sub-recetas (v1 confirmado: se listan ingredientes directos `RecipeIngredient`; las sub-recetas se listan por nombre sin selector de lote).
- Picker de Orden de Producción en el alta (v1: solo la columna `productionOrderId` en BD).
- Impresión directa a driver de impresora (se delega al diálogo de impresión del navegador con el PDF ya dimensionado).
- Fallback de conservación por `Category`.
- Plantillas de etiqueta personalizables por el usuario (layout fijo en v1).

## Fases

| Phase | Name | Status | Depende de |
|-------|------|--------|-----------|
| 1 | [Schema y registro de módulo](./phase-01-schema-y-registro-de-m-dulo.md) | Pending | Completed |
| 2 | [Backend núcleo Etiquetado](./phase-02-backend-n-cleo-etiquetado.md) | Pending | Completed |
| 3 | [Backend PDF+QR+trazabilidad](./phase-03-backend-pdf-qr-trazabilidad.md) | Pending | Completed |
| 4 | [Config conservación en Recetas y Artículos](./phase-04-config-conservaci-n-en-recetas-y-art-culos.md) | Pending | Completed |
| 5 | [Frontend módulo Etiquetado](./phase-05-frontend-m-dulo-etiquetado.md) | Pending | Completed |
| 6 | [Botones Etiquetar + pulido y docs](./phase-06-botones-etiquetar-pulido-y-docs.md) | Pending | 4, 5 |

Paralelizable: 3 y 4 tras la 1/2 (ficheros distintos). 4 depende solo de 1 (columnas Prisma) pero su frontend toca modales que conviven con la 5 — coordinar en 6.

**Bloqueo previo (validación 2026-08-31):** ninguna fase arranca hasta que `feat/recipe-yield-weight-anchor` se haya mergeado a `develop`. Esa rama modifica `schema.prisma` (`Recipe.portions Int→Float`, nuevo `Recipe.totalYieldWeight`, migración `20260831095709_recipe_yield_weight_and_decimal_portions`), `recipes/dto/create-recipe.dto.ts`, `recipes/dto/recipe-response.dto.ts`, `recipes.service.ts` — exactamente los ficheros de las fases 1 y 4. Implementar Etiquetado sobre `develop` sin mergear provocaría conflicto de migración y de DTOs. Al desbloquear: `git checkout develop && git pull && git checkout -b feat/etiquetado-alimentos`, revalidar que las columnas/tipos de receta asumidos siguen vigentes.

## Criterios de aceptación (globales)

- Migración Prisma **100% aditiva** (tablas nuevas + columnas nullable), sin backfill, aplicada en la BD de dev que usa el backend `:3001` sin pérdida de datos.
- Con el módulo `etiquetado` desactivado para un tenant, sus endpoints devuelven 403 (`ModuleGuard`) y la entrada de nav no aparece.
- Alta de etiqueta **plato elaborado** desde receta *Jarrete*: genera lote `JARR-DDMMAA-NN`, calcula consumo preferente = elaboración + vida útil de la receta, guarda snapshot de nombre/alérgenos/usuario y la lista de ingredientes con su lote elegido; produce PDF térmico y A4 con QR escaneable.
- Alta de etiqueta **artículo manipulado** desde artículo *Lubina*: enlaza a un `Lot` del proveedor, precarga `Lot.expiryDate` como caducidad de fabricante si existe, calcula consumo preferente secundario = manipulación + vida útil secundaria del artículo.
- Escanear el QR abre `/e/{qrToken}` **sin login**: ficha de solo lectura con producto, lote, fechas, conservación, alérgenos y lotes de ingredientes; el responsable aparece como iniciales/rol. Token inexistente → 404. Ruta con rate-limit (Throttler global).
- Re-impresión incrementa `reprintCount`; anular deja `voidedAt`/`voidReason` y la etiqueta desaparece del listado por defecto (filtro "incluir anuladas").
- Config de conservación editable y persistida en el modal de Receta y en el de Artículo.
- Tests backend en verde con **jest** (no `bun test`): servicios de lote, cálculo de fechas, snapshots, void/reprint, smoke de PDF. Typecheck frontend limpio.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Dimensionado de PDF térmico quisquilloso (rollo 57 mm ≈ 48 mm imprimible; anchos reales dependen de la impresora del usuario) | Presets fijos parametrizados en mm; iterar con `/ck:preview` sobre PDF real; dejar márgenes configurables por constante. Confirmar medidas exactas con el usuario antes de la fase 3. |
| Recetas con muchos ingredientes / sub-recetas → fricción al elegir lote | v1: solo ingredientes directos; "sin especificar" permitido; preselección de último lote; sub-recetas listadas por nombre. |
| Colisión de secuencia de lote entre sesiones concurrentes | `$queryRaw` `MAX(...)` (no `findFirst`, memoria `soft-delete-breaks-sequence-generators`) + `@@unique([tenantId, lotNumber])` + reintento en carrera. |
| Borrado (soft) de Receta/Artículo tras emitir etiqueta | Snapshots en `FoodLabel` (nombre, alérgenos, usuario); FKs `onDelete: SetNull`. |
| `globals.css` oculta `<header>`/`<nav>` no-`.fixed` (memorias) | Títulos de página y tab bars con `<div>` / `role="tablist"`. |
| Migrar la BD equivocada (dos Postgres en dev, memorias `two-postgres-databases-dev`) | Aplicar sobre la BD que usa el backend `:3001`; `prisma migrate diff` + `migration.sql` manual + `migrate deploy` (memoria `prisma-migrate-dev-non-interactive-workaround`). |

## Preguntas sin resolver

- Medidas exactas de la etiqueta térmica (ancho de rollo y área imprimible) y modelo/marca de impresora del usuario. **Bloqueante para afinar la fase 3.**
- Stock de etiquetas A4: ¿referencia concreta (p.ej. Apli 01278 = 3×8 / 70×35 mm)? Se asume una por defecto configurable por constante.
- ¿`labelType` debe permitir un tercer tipo "genérico" (etiqueta libre sin receta ni artículo)? Fuera de v1 salvo petición.
- ¿Cada cuándo se merge `feat/recipe-yield-weight-anchor`? Determina cuándo se desbloquea este plan.

## Validation Log

### Sesión 1 — 2026-08-31 (`/ck:plan validate`)

**Verificación contra código (tier completo, 6 fases):**
- Claims comprobados: 12 · Verificados: 8 · Fallidos: 4 · Sin verificar: 0
- Fallos y corrección:
  1. `branch: develop` → rama real `feat/recipe-yield-weight-anchor` con trabajo sin commitear. **Corregido:** `status: blocked`, plan no arranca hasta merge a develop.
  2. Fases 1/4 asumen `schema.prisma` y `recipes/*` limpios → hay modificaciones sin commitear en esos ficheros + migración `20260831095709`. **Corregido:** nota de bloqueo + paso de revalidación al desbloquear.
  3. `Recipe.portions` asumido `Int` → ya es `Float` (cambio sin commitear) y existe `Recipe.totalYieldWeight`. **Corregido:** fases 4/5 no dependen del tipo; se revalida al desbloquear.
  4. Fase 2 planteaba "extraer `LotService` a módulo compartido" por posible ciclo → `AlbaranesModule` **ya exporta** `LotService`. **Corregido:** fase 2 importa `AlbaranesModule` directamente; el riesgo de ciclo baja a nota.
- Verificados OK: guards de `sala-tasks`, `LotService.findLots()`, `pdfkit`+`qrcode` ya en deps, `/recipes/options`, `use-product-search.ts`, `Lot.expiryDate`, `module.guard.ts`, `nav-config.ts`.

**Decisiones confirmadas (6 preguntas):**
| # | Decisión |
|---|---|
| Base de rama | Esperar merge de `feat/recipe-yield-weight-anchor` → develop; luego rama nueva desde develop. Plan `blocked`. |
| Sub-recetas | v1 = solo ingredientes directos; sub-recetas listadas por nombre sin selector de lote. (Sin cambio respecto al plan.) |
| Auth del QR | **CAMBIO:** ficha del QR es **pública sin login** vía `qrToken` opaco. Ruta `/e/{qrToken}` fuera del muro de auth de `/dashboard`. Endpoint backend público con rate-limit. |
| Datos en vista pública | Ficha completa **excepto nombre del responsable** → iniciales/rol en la vista pública; nombre completo solo en el detalle interno autenticado. |
| Vínculo Producción v1 | **CAMBIO:** solo columna `productionOrderId` en BD; sin picker en la UI de v1. |
| Grupo de menú | Seguridad / APPCC. |

**Propagación a fases:** 2 (endpoint `/trace` → público + redacción responsable), 3 (ruta QR `/e/{qrToken}`, redacción, sin dep nueva `qrcode`), 5 (página `/e/[qrToken]` logged-out; quitar picker de orden de producción), 6 (grupo menú fijado). Fase 1 sin cambios materiales (`qrToken` ya opaco).

### Desbloqueo — 2026-08-31 20:40
- `feat/recipe-yield-weight-anchor` mergeado a `develop` vía PR #77 (`a316174 feat(recetas): peso total elaborado como ancla de rendimiento`).
- `develop:schema.prisma` ya trae `Recipe.portions Float` + `Recipe.totalYieldWeight Float?` + migración `20260831095709_recipe_yield_weight_and_decimal_portions`.
- `recipes/dto/create-recipe.dto.ts` sin campos de conservación (los añade la fase 4). `products` DTO sin cambios relevantes.
- **Plan `pending`.** Rama de trabajo creada: `feat/etiquetado-alimentos` desde `develop` (HEAD `a316174`).
- Recordatorio: la fase 3 sigue necesitando las medidas de la etiquetadora térmica y el stock A4 del usuario antes de fijar `LABEL_PRESETS`.

### Whole-Plan Consistency Sweep — 2026-08-31
- `/dashboard/etiquetado/t/{qrToken}` (mención antigua) → reemplazado por `/e/{qrToken}` en plan.md y fase 5. ✔
- "requiere sesión" / "sesión iniciada" en criterios → reescrito a acceso público. ✔
- "añadir `qrcode` a package.json" (fase 3) → ya es dependencia; marcado como no necesario. ✔
- "extraer `LotService` a módulo compartido" (fase 2) → degradado a nota; `AlbaranesModule` ya lo exporta. ✔
- Picker de orden de producción (fase 5) → eliminado de v1; `productionOrderId` permanece solo como columna. ✔
- Sin contradicciones abiertas.
