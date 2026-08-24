---
phase: 4
title: Tests y validación
status: completed
priority: P2
dependencies:
  - 2
  - 3
---

# Phase 4: Tests y validación

## Overview

Actualizar `production.service.spec.ts` al nuevo contrato (retirar los tests de reserva/disponibilidad de ingredientes, añadir cobertura de creación con y sin receta) y correr la suite completa del módulo. Cerrar con verificación manual en navegador — no basta con tests unitarios.

## Requirements

- Suite `jest` del módulo `production` en verde (no `bun test` — [[backend-tests-use-jest-not-bun-test]]).
- Cobertura para: crear orden solo-texto, crear orden con receta vinculada, `title` obligatorio (falla sin él), sin llamadas a `WarehousesService`.

## Architecture

`production.service.spec.ts` actual (líneas ~108-120, ~268-332) mockea `WarehousesService` y prueba: reserva de stock al crear con receta, `BadRequestException` si un ingrediente no está disponible. Estos tests dejan de tener sentido tras la fase 2 (no hay reserva, no hay `ingredients` en el DTO).

Reemplazar por:
- Test: crear orden con `{ batchId, title, estimatedTime }` (sin receta) → persiste con `recipeId: null`, `title` correcto.
- Test: crear orden con `{ batchId, title, estimatedTime, recipeId, recipeName }` → persiste ambos campos, sin ninguna llamada a servicios de stock.
- Test: DTO rechaza payload sin `title` (validación `class-validator`).
- Retirar el mock de `WarehousesService` del `TestingModule` si `ProductionService` ya no lo inyecta (confirmar contra el resultado real de la fase 2).

## Related Code Files

- Modify: `backend/src/modules/production/production.service.spec.ts`

## Implementation Steps

1. Leer el spec completo antes de editar (ya se identificaron las líneas ~108-120 y ~268-332 en el research de este plan, pero confirmar el archivo completo por si hay más referencias a ingredientes/stock no capturadas).
2. Quitar el mock `mockWarehousesService` y su `provide` en el `TestingModule` si la fase 2 confirmó que `ProductionService` ya no lo inyecta.
3. Reemplazar los tests de reserva/disponibilidad por los tres casos descritos en Architecture.
4. Correr la suite acotada al módulo: `cd backend && npx jest production.service.spec.ts` (o el comando equivalente del proyecto — confirmar en `package.json`).
5. Correr la suite completa del backend para descartar regresiones cruzadas: `cd backend && npx jest` (memoria [[backend-tests-use-jest-not-bun-test]] — no usar `bun test`).
6. Verificación manual en navegador (no sustituible por tests): levantar backend+frontend, crear un lote, crear una orden sin receta, crear una orden con receta vinculada, confirmar que ambas aparecen correctamente en el listado del lote con su `title`.

## Success Criteria

- [x] `npx jest production.service.spec.ts` en verde (46/46; 76/76 incluyendo `production.controller.spec.ts`).
- [x] Suite completa del backend en verde salvo 1 fallo preexistente ajeno (`albaranes.controller.spec.ts`, sin cambios de este plan en ese módulo — 1604/1605 en verde).
- [x] Verificación manual en navegador completada: login → LOTE-0002 → crear orden sin receta ("Verificación navegador — tarea sin receta") → aparece en el listado con su título; probado también vincular/quitar receta.
- [x] `grep -n "WarehousesService\|reserveStock" backend/src/modules/production/production.service.spec.ts` no devuelve nada.

## Risk Assessment

Riesgo bajo — es el cierre de verificación, no introduce cambios de comportamiento nuevos. El único riesgo real es dar el plan por completo solo con tests en verde sin la verificación manual en navegador, que las reglas del proyecto exigen explícitamente para cambios de UI.
