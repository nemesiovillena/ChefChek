---
phase: 1
title: Schema y migración
status: completed
priority: P1
dependencies: []
---

# Phase 1: Schema y migración

## Overview

Hacer `recipeId`/`recipeName` opcionales en `ProductionOrder`, añadir `title` obligatorio (con backfill), y aflojar `quantity`/`unit` a opcionales — ya no tienen sentido forzados para una tarea de texto libre sin ingredientes.

## Requirements

- Funcional: una `ProductionOrder` debe poder existir sin receta vinculada.
- No perder datos existentes: todo `recipeName` actual se copia a `title` antes de que la columna sea `NOT NULL` (regla [[zero-data-loss-mandatory-rule]]).
- Migración aditiva salvo el cambio de nullability de `recipeId`/`recipeName` (relajar a nullable nunca pierde datos).

## Architecture

Modelo actual (`backend/prisma/schema.prisma:1058-1090`):

```prisma
model ProductionOrder {
  id            String    @id @default(cuid())
  tenantId      String
  batchId       String
  recipeId      String
  recipeName    String
  quantity      Float
  unit          String
  estimatedTime Float
  orderNumber   String
  orderType     String
  status        String
  scheduledFor  DateTime
  startedAt     DateTime?
  completedAt   DateTime?
  items         Json?
  actualTime    Float?
  notes         String?
  createdBy     String
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  deletedAt     DateTime?
  ...
}
```

Cambios:
- `recipeId String` → `recipeId String?`
- `recipeName String` → `recipeName String?`
- `quantity Float` → `quantity Float?`
- `unit String` → `unit String?`
- Nuevo campo `title String` (obligatorio, sin default tras backfill)
- Nuevo campo `description String?` (opcional — descripción de la tarea libre; distinto de `notes`, que ya existía y se queda sin exponer en la creación, ver Validation Log Session 1)
- `estimatedTime`, `items`, `notes` no cambian — `estimatedTime` sigue obligatorio (lo usa `initializeProgressTracking` y el reporte de KPIs), `items` sigue existiendo pero deja de poblarse (fase 2), `notes` se queda tal cual está hoy (no se toca en este plan).

<!-- Updated: Validation Session 1 - se añade `description` nuevo, separado de `notes` -->


## Related Code Files

- Modify: `backend/prisma/schema.prisma` (modelo `ProductionOrder`, líneas ~1058-1090)
- Create: migración SQL manual en `backend/prisma/migrations/<timestamp>_production_order_free_text_title/migration.sql`

## Implementation Steps

1. Editar `schema.prisma`: aplicar los cambios de nullability y añadir `title String` (temporalmente `String?` para poder generar el diff sin que Prisma exija un default).
2. Generar el diff sin aplicar (memoria [[prisma-migrate-dev-non-interactive-workaround]] — `prisma migrate dev` es interactivo y no funciona en este entorno):
   ```bash
   cd backend
   npx prisma migrate diff \
     --from-schema-datasource prisma/schema.prisma \
     --to-schema-datamodel prisma/schema.prisma \
     --script > /tmp/diff.sql
   ```
   Usar el diff solo como referencia de las columnas — escribir el SQL final a mano para controlar el orden backfill → NOT NULL.
3. Crear la carpeta de migración manual con este contenido (confirmado: el proyecto usa camelCase literal en columnas, sin `@map` por campo — ver `20260810103755_alert_add_entity_reference/migration.sql` como referencia: `ADD COLUMN "entityId"`, no `entity_id`):
   ```sql
   ALTER TABLE "production_orders" ALTER COLUMN "recipeId" DROP NOT NULL;
   ALTER TABLE "production_orders" ALTER COLUMN "recipeName" DROP NOT NULL;
   ALTER TABLE "production_orders" ALTER COLUMN "quantity" DROP NOT NULL;
   ALTER TABLE "production_orders" ALTER COLUMN "unit" DROP NOT NULL;

   ALTER TABLE "production_orders" ADD COLUMN "title" TEXT;
   UPDATE "production_orders" SET "title" = "recipeName" WHERE "title" IS NULL;
   ALTER TABLE "production_orders" ALTER COLUMN "title" SET NOT NULL;

   ALTER TABLE "production_orders" ADD COLUMN "description" TEXT;
   ```
4. En `schema.prisma`, dejar `title String` (sin `?`) una vez el SQL ya la deja `NOT NULL`.
5. Aplicar en dev: `npx prisma migrate resolve` no aplica — usar `npx prisma migrate deploy` contra la base de dev (memoria [[two-postgres-databases-dev]] — confirmar cuál Postgres usa el backend en `:3001` antes de aplicar).
6. Regenerar el cliente Prisma: `npx prisma generate`.
7. Verificar con `SELECT COUNT(*) FROM production_orders WHERE title IS NULL` → debe ser 0.

## Success Criteria

- [x] `recipeId`, `recipeName`, `quantity`, `unit` son nullable en el schema y en la BD de dev.
- [x] `title` existe, es `NOT NULL`, y toda fila preexistente tiene `title = recipeName` (o vacío solo si `recipeName` ya era null, lo cual no debería ocurrir dado que era `NOT NULL` antes de esta migración).
- [x] `npx prisma generate` corre sin errores y el tipo `ProductionOrder` de Prisma Client refleja los nuevos campos.
- [x] No se perdió ninguna fila ni valor existente (`SELECT COUNT(*)` antes/después de la migración coincide — 1 fila preexistente, 0 con `title` NULL tras backfill).

## Risk Assessment

Riesgo bajo en dev (tabla nueva, sin uso real confirmado en el plan previo). La migración base (`20260805192254_production_module_rework`) ya está aplicada en producción (memoria de proyecto, 260806) — este ALTER es aditivo/relajación de constraints sobre esa misma tabla, mismo protocolo de backup por ser BD compartida con datos reales de otros tenants. Rollback: `DROP COLUMN title` es seguro (nadie la consume aún fuera de este plan); volver `recipeId`/`recipeName`/`quantity`/`unit` a `NOT NULL` requeriría antes verificar que ninguna fila nueva quedó con esos campos en null.
