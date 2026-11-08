-- Categoría propia de cada contador para agruparlos en la pantalla.
ALTER TABLE "portion_counters" ADD COLUMN "category" TEXT;

-- Contadores existentes: la categoría del artículo; los de receta, «Platos».
UPDATE "portion_counters" pc
SET "category" = c."name"
FROM "products" p
JOIN "categories" c ON c."id" = p."categoryId"
WHERE pc."productId" = p."id" AND pc."category" IS NULL;

UPDATE "portion_counters"
SET "category" = 'Platos'
WHERE "recipeId" IS NOT NULL AND "category" IS NULL;
