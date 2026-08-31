---
phase: 1
title: Schema y registro de módulo
status: completed
priority: P1
effort: ~0.5 sesión
dependencies: []
---

# Phase 1: Schema y registro de módulo

## Overview

Base de datos y registro del módulo. 100% aditivo: 2 tablas nuevas, columnas nullable en `Recipe`/`Product`, back-relations en `Lot`, entrada en `MODULE_REGISTRY` y `SECTION_REGISTRY`.

## Requirements

- Funcional: modelo de datos que soporte etiqueta de plato elaborado y de artículo manipulado, con snapshots para sobrevivir a borrados/renombrados, y trazabilidad de lotes de ingredientes.
- No funcional: migración reversible, sin `NOT NULL` nuevos en tablas con datos, sin backfill.

## Architecture

### `backend/prisma/schema.prisma`

**Nuevo `model FoodLabel`** (`@@map("food_labels")`):

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `tenantId` | `String` | FK Tenant, `onDelete: Cascade` |
| `labelType` | `String` | `ELABORATED` \| `HANDLED` |
| `recipeId` | `String?` | FK Recipe `onDelete: SetNull` (ELABORATED) |
| `productId` | `String?` | FK Product `onDelete: SetNull` (HANDLED) |
| `itemName` | `String` | snapshot del nombre |
| `lotNumber` | `String` | generado (ELABORATED) o del proveedor (HANDLED) |
| `sourceLotId` | `String?` | FK Lot `onDelete: SetNull` (HANDLED: lote de proveedor origen) |
| `productionOrderId` | `String?` | FK ProductionOrder `onDelete: SetNull` (vínculo opcional) |
| `preparedAt` | `DateTime` | fecha/hora de elaboración o de manipulación/reenvasado |
| `manufacturerExpiryDate` | `DateTime?` | caducidad original de fábrica (HANDLED) |
| `useByDate` | `DateTime` | consumo preferente calculado |
| `frozenAt` | `DateTime?` | si se congela |
| `frozenUseByDate` | `DateTime?` | consumo desde congelado calculado |
| `storageCondition` | `String` | `REFRIGERATED` \| `FROZEN` \| `AMBIENT` (snapshot) |
| `storageTempMin` | `Float?` | °C |
| `storageTempMax` | `Float?` | °C |
| `shelfLifeDaysApplied` | `Int?` | días de vida útil usados en el cálculo (snapshot) |
| `quantity` | `Float?` | |
| `quantityUnit` | `String?` | |
| `portions` | `Float?` | raciones (fraccionarias permitidas, coherente con `Recipe.portions Float` de la rama yield-weight) |
| `allergens` | `Int[] @default([])` | snapshot de IDs de alérgeno |
| `notes` | `String?` | |
| `createdByUserId` | `String` | |
| `createdByName` | `String` | snapshot |
| `reprintCount` | `Int @default(0)` | |
| `qrToken` | `String @unique @default(cuid())` | opaco, va en el QR; **usado para acceso público sin login → nunca secuencial ni derivable de `id`/`lotNumber`** (`cuid()` cumple) |
| `voidedAt` | `DateTime?` | anulación (no borrado) |
| `voidReason` | `String?` | |
| `createdAt` / `updatedAt` | `DateTime` | |

Relaciones: `tenant`, `recipe?`, `product?`, `sourceLot? Lot`, `productionOrder? ProductionOrder`, `ingredientLots FoodLabelIngredientLot[]`.
Índices: `@@index([tenantId])`, `@@index([tenantId, lotNumber])`, `@@unique([tenantId, lotNumber])`, `@@index([recipeId])`, `@@index([productId])`, `@@index([preparedAt])`.

**Nuevo `model FoodLabelIngredientLot`** (`@@map("food_label_ingredient_lots")`):

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `foodLabelId` | `String` | FK FoodLabel `onDelete: Cascade` |
| `productId` | `String?` | FK Product `onDelete: SetNull` (ingrediente) |
| `productName` | `String` | snapshot |
| `lotId` | `String?` | FK Lot `onDelete: SetNull` si se eligió un `Lot` registrado |
| `lotNumber` | `String` | snapshot o texto libre; `""`/`"SIN ESPECIFICAR"` permitido |
| `quantityUsed` | `Float?` | opcional (cantidad de la receta) |
| `unit` | `String?` | |

Índice: `@@index([foodLabelId])`.

**Columnas nuevas en `model Recipe`** (todas nullable, agrupadas con comentario `// Conservación / vida útil (etiquetado)`):
- `shelfLifeDays Int?` — días de vida útil tras elaboración (condición por defecto)
- `shelfLifeFrozenDays Int?` — días si se congela
- `storageCondition String?` — `REFRIGERATED` \| `FROZEN` \| `AMBIENT`
- `storageTempMin Float?`, `storageTempMax Float?`

**Columnas nuevas en `model Product`** (mismo bloque; semántica = caducidad secundaria tras apertura/manipulación):
- `secondaryShelfLifeDays Int?`
- `shelfLifeFrozenDays Int?`
- `storageCondition String?`
- `storageTempMin Float?`, `storageTempMax Float?`

**Back-relations en `model Lot`**: `foodLabels FoodLabel[]`, `foodLabelIngredientLots FoodLabelIngredientLot[]`.
**Back-relation en `model ProductionOrder`**: `foodLabels FoodLabel[]`.
**Back-relations en `model Recipe` / `model Product` / `model Tenant`**: `foodLabels FoodLabel[]` (y `foodLabelIngredientLots FoodLabelIngredientLot[]` en Product).

### `backend/src/modules/modules/constants/registry.ts`

Añadir al `MODULE_REGISTRY`:
```ts
{
  id: "etiquetado",
  name: "Etiquetado",
  description:
    "Etiquetas de cocina con trazabilidad para platos elaborados y artículos manipulados",
  dependencies: [],
  alwaysActive: false,
  defaultEnabled: false,
},
```

### `backend/src/modules/role-access/constants/section-registry.ts`

Añadir sección (grupo Seguridad/APPCC):
```ts
{ key: "etiquetado", label: "Etiquetado", moduleId: "etiquetado", defaultAllowed: true },
{ key: "etiquetado.emit", label: "Emitir etiquetas", parent: "etiquetado", defaultAllowed: true },
```
(`VIEWER` normalmente sin `etiquetado.emit`; decisión de config, no de código.)

## Related Code Files

- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_add_food_labeling/migration.sql` (vía `prisma migrate diff`)
- Modify: `backend/src/modules/modules/constants/registry.ts`
- Modify: `backend/src/modules/modules/modules.service.spec.ts` (longitud esperada del registry)
- Modify: `backend/src/modules/role-access/constants/section-registry.ts`
- Modify: `backend/src/modules/role-access/role-access.service.spec.ts` si itera el registry

## Implementation Steps

1. Editar `schema.prisma`: 2 modelos nuevos + columnas + back-relations. Ejecutar `npx prisma format`.
2. Generar SQL: `npx prisma migrate diff --from-schema-datasource ... --to-schema-datamodel prisma/schema.prisma --script > migration.sql`; revisar a mano que es aditivo (sólo `CREATE TABLE`, `ALTER TABLE ... ADD COLUMN ... NULL`, `CREATE INDEX`).
3. Aplicar en la BD de dev del backend `:3001` con `npx prisma migrate deploy` (o `migrate resolve` según memoria del flujo sin TTY).
4. `npx prisma generate`.
5. Actualizar specs que cuentan entradas del registry.
6. `npx jest src/modules/modules src/modules/role-access` verde; `tsc --noEmit` backend verde.

## Success Criteria

- [ ] `prisma migrate status` limpio; migración aditiva revisada manualmente.
- [ ] `npx prisma generate` sin errores; tipos `FoodLabel` disponibles.
- [ ] `MODULE_REGISTRY` incluye `etiquetado` (`defaultEnabled: false`); specs actualizados y verdes.
- [ ] `SECTION_REGISTRY` incluye `etiquetado` + `etiquetado.emit`.
- [ ] `tsc --noEmit` backend verde.

## Risk Assessment

- Migrar la BD equivocada (dos Postgres en dev) → aplicar sobre la que usa `:3001`, verificar con `\dt food_labels` tras aplicar.
- `@@unique([tenantId, lotNumber])` podría chocar si en el futuro se importan etiquetas — aceptable, es el invariante deseado.
