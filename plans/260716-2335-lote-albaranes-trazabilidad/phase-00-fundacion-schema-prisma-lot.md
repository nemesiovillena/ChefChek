# Fase 00: Fundación — schema Prisma (`Lot`, `StockMovement.lotId`)

**Estado: ✅ implementada.** Migración `20260716215419_add_lot_traceability` generada, revisada (100% aditiva) y aplicada en dev.

## Contexto
Ver `plan.md`. `Stock` (schema.prisma:1163-1186) tiene `@@unique([productId, warehouseId])` — no se toca. `StockMovement` (schema.prisma:701-715) no tiene columna `lot`. Diseño 100% aditivo.

## Archivos a modificar
- `backend/prisma/schema.prisma`

## Archivos a crear
- Nueva migración Prisma (generada por `prisma migrate dev`, no escribir el SQL a mano salvo revisión final)

## Implementación

### 1. Nuevo modelo `Lot`
Añadir tras el modelo `AlbaranLine` (schema.prisma, después de línea ~1716):

```prisma
model Lot {
  id            String    @id @default(cuid())
  tenantId      String
  productId     String
  albaranLineId String?   @unique // línea de origen; 1 lote por línea recibida
  lotNumber     String
  quantity      Float // cantidad recibida en este lote (no se decrementa en este plan)
  warehouseId   String?
  supplierId    String?
  receivedAt    DateTime  @default(now())
  expiryDate    DateTime? // reservado; sin captura por UI todavía
  notes         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  tenant      Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  product     Product      @relation(fields: [productId], references: [id], onDelete: Cascade)
  albaranLine AlbaranLine? @relation(fields: [albaranLineId], references: [id], onDelete: SetNull)
  warehouse   Warehouse?   @relation(fields: [warehouseId], references: [id], onDelete: SetNull)
  supplier    Supplier?    @relation(fields: [supplierId], references: [id], onDelete: SetNull)

  stockMovements StockMovement[]

  @@index([tenantId])
  @@index([productId])
  @@index([lotNumber])
  @@map("lots")
}
```

### 2. `StockMovement.lotId` opcional
En el modelo `StockMovement` (schema.prisma:701-715), añadir:
```prisma
  lotId       String?
  lot         Lot?     @relation(fields: [lotId], references: [id], onDelete: SetNull)
```

### 3. Relaciones inversas obligatorias en Prisma
Añadir el lado inverso de la relación en los modelos referenciados (Prisma lo exige):
- `Tenant`: añadir `lots Lot[]`
- `Product`: añadir `lots Lot[]`
- `AlbaranLine`: añadir `lot Lot?` (relación inversa 1:1, distinta del campo escalar `lot String?` ya existente — **cuidado con colisión de nombre**: el campo escalar de línea se llama `lot` (String, número de lote). Para evitar choque de nombre con la relación inversa, nombrar la relación inversa `lotRecord Lot?` en `AlbaranLine`.)
- `Warehouse`: añadir `lots Lot[]`
- `Supplier`: añadir `lots Lot[]`

### 4. Generar y revisar la migración
```bash
cd backend
npx prisma migrate dev --name add_lot_traceability
```
Revisar el SQL generado antes de aplicar en cualquier entorno con datos reales: debe contener solo `CREATE TABLE "lots"` y `ALTER TABLE "stock_movements" ADD COLUMN "lotId" TEXT` + FKs — ninguna sentencia `DROP`/`ALTER COLUMN ... NOT NULL` sobre tablas existentes.

## Tests / validación
- `npx prisma validate`
- `npx prisma migrate dev` en local sin errores
- Confirmar con `\d stock_movements` (psql) que `lotId` es nullable
- Revisar memoria del proyecto: dos bases Postgres en dev (brew :5432 vs docker :5433) — aplicar la migración en la que realmente usa el backend activo en :3001

## Riesgos y rollback
- Riesgo: aplicar por error en la BD equivocada de las dos activas en dev. Verificar `DATABASE_URL` antes de migrar.
- Rollback: `npx prisma migrate resolve --rolled-back <nombre_migracion>` + `DROP TABLE lots; ALTER TABLE stock_movements DROP COLUMN "lotId";` — seguro porque no hay datos que perder (tabla nueva, columna nueva vacía).
