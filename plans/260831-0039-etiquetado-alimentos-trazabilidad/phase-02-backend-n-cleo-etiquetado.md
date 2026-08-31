---
phase: 2
title: Backend núcleo Etiquetado
status: completed
priority: P1
effort: ~1 sesión
dependencies:
  - 1
---

# Phase 2: Backend núcleo Etiquetado

## Overview

Módulo Nest `etiquetado`: generador de nº de lote, servicio de negocio (crear / listar / detalle / anular / re-marcar impresión), cálculo de fechas de consumo, snapshots, endpoint de contexto para el formulario. Sin PDF (fase 3).

## Requirements

- Funcional:
  - Crear etiqueta `ELABORATED` desde `recipeId`: genera `lotNumber`, calcula `useByDate`, snapshot de nombre/alérgenos/usuario, persiste `FoodLabelIngredientLot[]` a partir del payload.
  - Crear etiqueta `HANDLED` desde `productId` + `sourceLotId?`: precarga caducidad de fabricante desde `Lot.expiryDate`, calcula `useByDate` (secundaria).
  - Congelación opcional: si `frozenAt` presente, calcular `frozenUseByDate` con `shelfLifeFrozenDays`.
  - Overrides puntuales de conservación/vida útil respetados sobre la config de la entidad.
  - Listado paginado server-side con filtros (`labelType`, rango de fechas por `preparedAt`, `recipeId`/`productId`, búsqueda por `lotNumber`, `includeVoided`).
  - `prep-context`: dada una receta → ingredientes directos + lotes disponibles por ingrediente + config de conservación; dado un artículo → artículo + sus lotes + `expiryDate` candidata + config secundaria.
  - Anular (`voidedAt`, `voidReason`); nunca borrado físico.
- No funcional: DRY con `LotService` (lectura de lotes) del módulo `albaranes`; guards idénticos a `sala-tasks`.

## Architecture

### Estructura (`backend/src/modules/etiquetado/`)

```
etiquetado.module.ts
etiquetado.controller.ts
services/
  lot-number.service.ts        # genera PREFIJO-DDMMAA-NN
  food-label.service.ts        # CRUD + cálculo + snapshots
  food-label-context.service.ts# prep-context (ingredientes + lotes + config)
dto/
  create-food-label.dto.ts
  list-food-labels.dto.ts
  void-food-label.dto.ts
util/
  shelf-life.util.ts           # addDays, resolución de condición/temps efectivas
  lot-prefix.util.ts           # nombre receta -> prefijo 3-4 letras sin acentos
```

### `LotNumberService.generateElaboratedLot(tenantId, recipeName, date)`

- Prefijo: `lot-prefix.util` → quita acentos (NFD), quita no `[A-Z0-9]`, toma primeras 3–4 letras en mayúsculas del primer token significativo; fallback `"ETIQ"`.
- Fecha: `DDMMAA` de `date` en zona `Europe/Madrid`.
- Secuencia `NN`: `SELECT MAX(...)` vía `$queryRaw` sobre `food_labels` filtrando `tenantId` y `lotNumber LIKE '%-DDMMAA-%'` (secuencia diaria global por tenant), `+1`, `padStart(2,'0')`. **No** `findFirst` (memoria `soft-delete-breaks-sequence-generators`).
- Reintento (hasta 3) ante violación de `@@unique([tenantId, lotNumber])` por carrera.

### `ShelfLifeUtil`

- `resolveConservation(entityConfig, overrides)` → `{ storageCondition, tempMin, tempMax, shelfLifeDays, shelfLifeFrozenDays }` efectivos (override > config entidad > `null`).
- `computeUseByDate(preparedAt, shelfLifeDays)` → `preparedAt + N días` (a fin del día local, 23:59, para no confundir).
- `computeFrozenUseByDate(frozenAt, shelfLifeFrozenDays)`.
- Si no hay días definidos y no hay override → `useByDate` es obligatorio en el DTO (el usuario lo teclea); validación en el servicio.

### `FoodLabelService`

- `create(tenantId, user, dto)`:
  - Carga receta o producto (incluye alérgenos, config conservación; receta incluye `ingredients { product }` y `subRecipes { subRecipe }`).
  - `ELABORATED`: `lotNumber = LotNumberService.generate...`; snapshot `itemName`, `allergens` (agregados de receta — reutilizar lógica existente de agregación de alérgenos de receta si es barata, si no `recipe.allergens`), `createdByName`.
  - `HANDLED`: si `sourceLotId`, validar que el `Lot` es del `productId` y tenant; `manufacturerExpiryDate ??= lot.expiryDate`; `lotNumber = dto.lotNumber ?? lot.lotNumber`.
  - Calcula `useByDate` / `frozenUseByDate` con `ShelfLifeUtil`.
  - Crea `FoodLabel` + `FoodLabelIngredientLot[]` (de `dto.ingredientLots`, cada uno con snapshot `productName`, `lotNumber`; si trae `lotId` validar pertenencia al `productId`).
  - Transacción única.
- `list(tenantId, query)` — paginación server-side (patrón del proyecto: `page`, `pageSize`, `total`), excluye `voidedAt != null` salvo `includeVoided`.
- `getById(tenantId, id)` / `getByQrToken(tenantId, token)` — incluye `ingredientLots`, `recipe`/`product`/`sourceLot`.
- `void(tenantId, id, reason, user)` — set `voidedAt`, `voidReason`; idempotente si ya anulada → 409/400.
- `markReprinted(tenantId, id)` — `reprintCount++` (llamado desde fase 3 al generar PDF de una etiqueta ya existente).

### `FoodLabelContextService`

- `forRecipe(tenantId, recipeId)`:
  - `ingredients`: lista de `{ productId, productName, quantity, unit, availableLots: Lot[] (via LotService.findLots({productId})), lastKnownLot: product.lot }`.
  - `subRecipes`: `[{ subRecipeId, name }]` (sin lotes en v1).
  - `conservation`: campos de la receta.
- `forProduct(tenantId, productId)`:
  - `lots`: `LotService.findLots({ productId })` ordenados por `receivedAt desc`.
  - `conservation`: campos secundarios del producto.
  - `manufacturerExpiryCandidate`: `lots[0]?.expiryDate ?? null`.

### `etiquetado.controller.ts`

`@UseGuards(AuthGuard, TenantGuard, ModuleGuard, SectionAccessGuard)` + `@RequireModule("etiquetado")` (plantilla exacta: `sala-tasks.controller.ts`).

| Método | Ruta | Sección | Notas |
|---|---|---|---|
| `POST` | `/api/v1/etiquetado/labels` | `etiquetado.emit` | crea |
| `GET` | `/api/v1/etiquetado/labels` | `etiquetado` | listado paginado |
| `GET` | `/api/v1/etiquetado/labels/:id` | `etiquetado` | detalle |
| `POST` | `/api/v1/etiquetado/labels/:id/void` | `etiquetado.emit` | anular |
| `GET` | `/api/v1/etiquetado/prep-context` | `etiquetado.emit` | `?recipeId=` o `?productId=` |

<!-- Updated: Validation Session 1 - trace endpoint es PÚBLICO, va en su propio controller sin guards -->

**Endpoint público de trazabilidad** (validación 2026-08-31): la ficha del QR es de acceso **sin login**. Va en un controller aparte `etiquetado-public.controller.ts` **sin** `AuthGuard`/`TenantGuard`/`ModuleGuard`/`SectionAccessGuard`, con `@SkipThrottle(false)` (rate-limit del Throttler global activo):

| `GET` | `/api/v1/etiquetado/public/trace/:qrToken` | — (público) | resuelve `qrToken` opaco; 404 si no existe |

- Respuesta pública: `itemName`, `lotNumber`, `labelType`, `preparedAt`, `useByDate`, `manufacturerExpiryDate`, `frozenAt`, `frozenUseByDate`, `storageCondition`, temps, `allergens`, `quantity`/`portions`, `ingredientLots` (nombre + lote), `voidedAt`. **Responsable: solo iniciales o rol** (`createdByName` completo NO se expone aquí).
- El detalle interno autenticado (`GET /api/v1/etiquetado/labels/:id`) sí devuelve `createdByName` completo.

(`GET /labels/:id/pdf` render → fase 3.)

### `etiquetado.module.ts`

`imports: [AuthModule, AlbaranesModule, ...]` (memoria `nestjs-authguard-needs-authmodule`). **`AlbaranesModule` ya exporta `LotService`** (verificado en validación: `albaranes.module.ts` lo lista en `exports`), así que basta importarlo — no hace falta extraer `LotService` a un módulo compartido. Vigilar ciclo de imports al añadir `AlbaranesModule`; si aparece, extraer `LotService` a un `LotModule` mínimo. Registrar `EtiquetadoModule` en `AppModule`.

## Related Code Files

- Create: todo `backend/src/modules/etiquetado/**`
- Modify: `backend/src/app.module.ts` (registrar `EtiquetadoModule`)
- Modify: `backend/src/modules/albaranes/albaranes.module.ts` si hay que exportar `LotService`
- Reference: `backend/src/modules/sala-tasks/*` (plantilla de guards + módulo)
- Reference: `backend/src/modules/albaranes/services/lot.service.ts` (`findLots`)
- Create: specs `*.spec.ts` para `lot-number.service`, `food-label.service`, `etiquetado.controller`

## Implementation Steps

1. `lot-prefix.util` + `shelf-life.util` + tests unitarios (acentos, fin de día, sin config).
2. `LotNumberService` + spec (secuencia, padding, colisión simulada).
3. DTOs con `class-validator`; recordar `@Transform` para números que puedan llegar como string (memoria `backend-validationpipe-no-coerces-numbers`).
4. `FoodLabelService` (create/list/get/void/markReprinted) + spec con mock de Prisma y `LotService`.
5. `FoodLabelContextService` + spec.
6. `etiquetado.controller` + `etiquetado.module`; registrar en `AppModule`.
7. Resolver import de `LotService` sin ciclo (si ciclo → extraer a `LotModule` compartido).
8. `npx jest src/modules/etiquetado` verde; suite backend completa sin regresiones; `tsc --noEmit` verde.

## Success Criteria

- [ ] `POST /labels` (ELABORATED) genera `JARR-DDMMAA-01` y persiste ingredientes con lote.
- [ ] `POST /labels` (HANDLED) enlaza `sourceLot`, precarga `manufacturerExpiryDate`.
- [ ] `useByDate` = `preparedAt` + vida útil; error si no hay días ni override ni fecha explícita.
- [ ] `frozenUseByDate` calculado sólo si `frozenAt`.
- [ ] Listado pagina y excluye anuladas por defecto.
- [ ] `prep-context` devuelve ingredientes + lotes + config para receta y para artículo.
- [ ] Endpoints autenticados devuelven 403 con módulo desactivado (test de `ModuleGuard`).
- [ ] `GET /api/v1/etiquetado/public/trace/:qrToken` responde **sin cabecera de sesión** y **sin** `X-Tenant-Slug`; token inexistente → 404; NO expone `createdByName` completo (solo iniciales/rol).
- [ ] Specs nuevos + suite backend completa verde con jest.

## Risk Assessment

- Ciclo de imports al añadir `AlbaranesModule` (es un módulo grande) → si Nest reporta ciclo, extraer solo `LotService` + su dependencia de Prisma a un `LotModule` mínimo y que ambos módulos lo importen. Plan A: importar `AlbaranesModule` tal cual.
- Agregación de alérgenos de receta con sub-recetas (memoria `recipe-allergens-need-subrecipe-ingredients`): v1 usa `recipe.allergens` ya calculado; no recalcular aquí.
