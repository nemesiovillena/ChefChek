---
title: Desacoplar Órdenes de Producción de Recetas (tarea libre)
description: >-
  El modal de creación de Orden dentro de un Lote de Producción obliga a elegir
  una receta. El usuario no necesita coste de lote, ni ingredientes/receta
  calculados en Producción (ya los ve en el módulo Recetas), ni el chequeo de
  disponibilidad de stock. La receta pasa a ser una referencia opcional; el
  título de texto libre es el campo obligatorio.
status: completed
priority: P2
branch: main
tags:
  - production
  - prisma-migration
  - backend
  - frontend
blockedBy: []
blocks: []
created: '2026-08-10T11:02:38.329Z'
createdBy: 'ck:plan'
source: skill
---

# Desacoplar Órdenes de Producción de Recetas (tarea libre)

## Overview

`ProductionOrder.recipeId`/`recipeName` son hoy obligatorios (`backend/prisma/schema.prisma:1058-1090`), y `createProductionOrder` (`backend/src/modules/production/production.service.ts:126-177`) fuerza reserva de stock por ingrediente, bloqueando la creación si falta disponibilidad. El modal (`order-create-dialog.tsx`) exige elegir receta antes de poder enviar el formulario.

Decisión del usuario (no reabrir): no necesita coste de lote, no necesita ingredientes/receta calculados dentro de Producción (ya los ve en "Recetas"), no necesita el chequeo de stock. La receta pasa a ser una referencia opcional de trazabilidad; el campo obligatorio de la orden pasa a ser un `title` de texto libre.

Consecuencia de eliminar la reserva de ingredientes: `reserveIngredient`, `convertToProductReferenceUnit`, `updateInventory` y la dependencia de `WarehousesService` quedan sin ningún llamador — se retiran como código muerto (no se dejan "por si acaso").

## Contexto relacionado

Este plan modifica el mismo modelo `ProductionOrder` que reconstruyó [`260805-1923-production-module-rework`](../260805-1923-production-module-rework/plan.md) (mergeado a `main` en el commit `3e868e1`). Según la memoria persistente del proyecto, esa migración base (`20260805192254_production_module_rework`) **ya se aplicó en producción el 260806** (backup manual + `prisma migrate deploy` en el arranque del contenedor, verificado con `/health` y el endpoint `production/batches`). El `plan.md` de esa carpeta todavía dice "único punto pendiente: aplicar la migración en producción" — ese texto quedó desactualizado y conviene corregirlo por separado, pero no bloquea este plan.

No hay dependencia de bloqueo: el código en `main` ya refleja ese schema, y su migración base ya está en prod. La migración de este plan (fase 1) es aditiva sobre esa base y sigue el mismo protocolo de backup por tratarse de la misma BD compartida con datos reales de otros tenants ([[zero-data-loss-mandatory-rule]]).

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Schema y migración](./phase-01-schema-y-migraci-n.md) | Completed |
| 2 | [Backend DTO y limpieza de servicio](./phase-02-backend-dto-y-limpieza-de-servicio.md) | Completed |
| 3 | [Frontend modal y tipos](./phase-03-frontend-modal-y-tipos.md) | Completed |
| 4 | [Tests y validación](./phase-04-tests-y-validaci-n.md) | Completed |

## Dependencias

Secuencial: fase 1 → fase 2 → fase 3 → fase 4. No paralelizable (fase 2 depende del schema de fase 1; fase 3 depende del contrato DTO de fase 2).

## Riesgo principal

Breaking change en el contrato de `POST /v1/production/orders`: `recipeId`/`recipeName` pasan de obligatorios a opcionales y `ingredients` desaparece del DTO. No hay integraciones externas conocidas sobre este endpoint (uso interno del frontend propio) — verificar en fase 2 que no hay otro consumidor.

Migración con `ALTER TABLE production_orders`: columna nueva `title` debe backfillearse desde `recipeName` antes de marcarla `NOT NULL` (memoria [[prisma-migrate-dev-non-interactive-workaround]] — usar `migrate diff` + SQL manual, no `migrate dev` interactivo).

## Validation Log

### Verification Results
- **Tier:** Standard (4 fases → Fact Checker + Contract Verifier)
- **Claims checked:** 11
- **Verified:** 9 | **Failed:** 2 | **Unverified:** 0

#### Failures (corregidas en el plan)
1. [Fact Checker] Fase 2 citaba el método como `checkAndCreateDelayAlert` — el nombre real es `checkForDelays` (`production.service.ts:835`). Corregido.
2. [Contract Verifier] Fase 3 asumía que había que "verificar si `SubRecipeCombobox` soporta deseleccionar" como pregunta abierta — verificado directamente: no tiene botón de limpiar, pero su trigger ya maneja `value`/`label` vacíos (línea 51), así que la solución es un botón externo en `order-create-dialog.tsx` sin tocar el componente compartido. Corregido con la solución concreta, ya no es una pregunta abierta.

#### Verificado sin cambios
- `ProductionOrder` (schema.prisma:1058-1090), `CreateProductionOrderDto` (production.dto.ts:74-95), `createProductionOrder`/`completeProductionOrder` (production.service.ts:126-177, 208+), `WarehousesService` usado solo en `reserveIngredient` (grep confirmó único caller), `unit-conversion.util.ts` sin otros importadores fuera de production.service.ts, convención camelCase en columnas (confirmado contra `20260810103755_alert_add_entity_reference/migration.sql`), `ProductionIngredientInput` solo usado en `order-create-dialog.tsx`+`use-production.ts`, `notifyProductionDelay` (notifications.service.ts:94-109), líneas de tests en `production.service.spec.ts` (~108-120, ~268-332).

### Whole-Plan Consistency Sweep (verificación previa)
- Files reread: plan.md, phase-01-schema-y-migraci-n.md, phase-02-backend-dto-y-limpieza-de-servicio.md, phase-03-frontend-modal-y-tipos.md, phase-04-tests-y-validaci-n.md
- Decision deltas checked: 2 (nombre de método corregido, solución de deselección de receta resuelta)
- Reconciled stale references: 2
- Unresolved contradictions: 0

### Session 1 — 2026-08-10
**Trigger:** Validación estándar tras verificación (4 fases, tier Standard).
**Questions asked:** 3

#### Questions & Answers

1. **[Assumptions]** Para una orden sin receta, ¿tiene sentido pedir «cantidad»+«unidad», o se quitan del todo de la creación de órdenes?
   - Options: Opcionales (Recomendado) | Se quitan del todo
   - **Answer:** Opcionales (Recomendado)
   - **Rationale:** Siguen siendo útiles cuando hay receta vinculada (ej. "10 raciones"); no forzados para tareas libres. Sin cambios sobre el plan ya escrito.

2. **[Architecture]** El campo `notes` ya existe pero nunca se exponía en la creación. ¿Se reutiliza como descripción de la tarea libre, o se separa en un `description` nuevo?
   - Options: Reutilizar `notes` (Recomendado) | Nuevo campo `description`
   - **Answer:** Nuevo campo `description`
   - **Rationale:** `notes` queda libre para anotaciones futuras distintas de la descripción inicial de la tarea (ej. incidencias durante la ejecución). Requiere propagar a fases 1, 2 y 3.

3. **[Scope]** Al quitar la reserva de stock, `WarehousesService`/`AlmacenesModule` quedan sin uso en Producción. ¿Se retiran del todo o se dejan cableados?
   - Options: Retirar del todo (Recomendado) | Dejar cableado sin usar
   - **Answer:** Retirar del todo (Recomendado)
   - **Rationale:** Consistente con la regla del proyecto de no dejar código muerto. Sin cambios sobre el plan ya escrito.

#### Confirmed Decisions
- `quantity`/`unit`: opcionales, sin cambios de scope — decisión ya reflejada en fase 1/2/3.
- Campo de descripción de tarea libre: **`description` nuevo**, no `notes` — `notes` se queda tal cual está hoy (existente en schema, sin exponer en creación, sin tocar en este plan).
- Limpieza `WarehousesService`/`AlmacenesModule`/`unit-conversion.util.ts`: retiro completo, sin cambios de scope — ya reflejado en fase 2.

#### Action Items
- [x] Fase 1: añadir `description String?` al schema/migración (nuevo, no confundir con `notes` existente).
- [x] Fase 2: `CreateProductionOrderDto.description?` en vez de `notes`; persistir `description: dto.description`.
- [x] Fase 3: el textarea del modal mapea a `description`, no a `notes`.

#### Impact on Phases
- Phase 1: añadir columna `description` a la migración.
- Phase 2: DTO y `data` de creación usan `description`, no `notes`.
- Phase 3: estado y payload del modal usan `description`, no `notes`.

### Whole-Plan Consistency Sweep (post-propagación)
- Files reread: plan.md, phase-01-schema-y-migraci-n.md, phase-02-backend-dto-y-limpieza-de-servicio.md, phase-03-frontend-modal-y-tipos.md, phase-04-tests-y-validaci-n.md
- Decision deltas checked: 1 (`notes` → `description` en creación de orden)
- Reconciled stale references: 3 (fases 1, 2, 3)
- Unresolved contradictions: 0

## Criterios de aceptación (global)

- Se puede crear una orden de producción con solo `título` + `tiempo estimado`, sin seleccionar receta.
- Se puede crear una orden de producción vinculando una receta (opcional), sin que se dispare cálculo de coste, chequeo de stock ni reserva de ingredientes.
- El listado de órdenes del lote (`batch-detail-panel.tsx`) muestra `title` en vez de `recipeName`.
- Ningún código muerto queda tras la limpieza: `reserveIngredient`, `convertToProductReferenceUnit`, `updateInventory`, `WarehousesService` en `ProductionModule`, y `backend/src/modules/production/utils/unit-conversion.util.ts` se retiran si quedan sin uso (verificar en fase 2, no asumir).
- Suite de tests del módulo `production` en verde (`jest`, no `bun test` — [[backend-tests-use-jest-not-bun-test]]).
- Verificación manual en navegador: crear orden solo-texto y orden con receta vinculada, ambas persisten y se listan correctamente.
