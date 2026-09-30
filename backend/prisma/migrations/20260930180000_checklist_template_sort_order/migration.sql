-- AlterTable
ALTER TABLE "checklist_templates" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Conserva el orden que ya se veía (zona y nombre) como punto de partida.
UPDATE "checklist_templates" t
SET "sortOrder" = o.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "tenantId" ORDER BY area, name) - 1 AS rn
  FROM "checklist_templates"
) o
WHERE t.id = o.id;
