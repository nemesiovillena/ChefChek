-- AlterTable
ALTER TABLE "checklist_template_items" ADD COLUMN     "defaultValue" DOUBLE PRECISION;


-- Valor habitual inicial = centro del rango (redondeado) en los ítems de
-- medición que tienen rango completo y aún no tienen valor. Solo rellena
-- configuración del Plan (editable); no toca ningún registro.
UPDATE "checklist_template_items" AS i
SET "defaultValue" = ROUND((i."expectedRangeMin" + i."expectedRangeMax") / 2)
FROM "checklist_templates" AS t
WHERE t."id" = i."templateId"
  AND t."mode" = 'MEASUREMENT'
  AND i."defaultValue" IS NULL
  AND i."expectedRangeMin" IS NOT NULL
  AND i."expectedRangeMax" IS NOT NULL;
