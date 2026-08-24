-- AlterTable
ALTER TABLE "albaran_lines" ADD COLUMN     "lineOrder" INTEGER NOT NULL DEFAULT 0;

-- Backfill: aproxima el orden original para líneas ya existentes (createdAt/id
-- como desempate; no hay forma de recuperar el orden real del documento si ya
-- se perdió, pero es mejor punto de partida que 0 para todas).
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "albaranId" ORDER BY "createdAt" ASC, id ASC) - 1 AS rn
  FROM "albaran_lines"
)
UPDATE "albaran_lines" AS al
SET "lineOrder" = ordered.rn
FROM ordered
WHERE al.id = ordered.id;
