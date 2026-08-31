# Fase 1 — Migración schema + backfill

## Contexto
- `backend/prisma/schema.prisma` modelo `Recipe` (~l.360-400): `portions Int @default(1)`,
  `portionSize Float @default(1)`.
- `Menu.portions` (~l.647) NO se toca.
- Migración manual sin TTY: [[prisma-migrate-dev-non-interactive-workaround]]
  (`migrate diff` → `migration.sql` → `migrate deploy`).
- Dev usa la BD Postgres del backend :3001 ([[two-postgres-databases-dev]]).

## Cambios schema (`Recipe`)
```prisma
// Rendimiento
portions        Float  @default(1)   // raciones (admite decimales)
portionSize     Float  @default(1)   // peso ración (g) — derivado = totalYieldWeight / portions
totalYieldWeight Float? // peso total elaborado (g); ancla de rendimiento
```

## migration.sql
```sql
ALTER TABLE "recipes" ALTER COLUMN "portions" TYPE double precision;
ALTER TABLE "recipes" ADD COLUMN "totalYieldWeight" double precision;
UPDATE "recipes" SET "totalYieldWeight" = "portions" * "portionSize"
  WHERE "totalYieldWeight" IS NULL;
```

## Pasos
1. Editar `schema.prisma`.
2. `bunx prisma migrate diff --from-schema-datasource ... --to-schema-datamodel ... --script > migration.sql` en carpeta nueva
   `backend/prisma/migrations/<ts>_recipe_yield_weight_and_decimal_portions/`.
   Ajustar el `UPDATE` de backfill a mano (diff no lo genera).
3. `bunx prisma migrate deploy`.
4. `bunx prisma generate`.

## Validación
- `SELECT id, portions, "portionSize", "totalYieldWeight" FROM recipes LIMIT 5;`
  → `totalYieldWeight ≈ portions*portionSize` en todas.
- `bunx prisma migrate status` limpio.

## Rollback
- `ALTER TABLE "recipes" DROP COLUMN "totalYieldWeight";`
- `ALTER COLUMN "portions" TYPE integer USING round("portions");` (solo si no hay decimales grabados).
