-- Rendimiento de receta: peso total elaborado como ancla + raciones decimales.

-- AlterTable
ALTER TABLE "recipes" ADD COLUMN     "totalYieldWeight" DOUBLE PRECISION,
ALTER COLUMN "portions" SET DEFAULT 1,
ALTER COLUMN "portions" SET DATA TYPE DOUBLE PRECISION;

-- Backfill: la invariante es totalYieldWeight = portions * portionSize.
UPDATE "recipes"
SET "totalYieldWeight" = "portions" * "portionSize"
WHERE "totalYieldWeight" IS NULL;
