-- El contador de raciones muestra siempre el nombre actual de su artículo o
-- receta. portion_counters.name es una copia que estos triggers mantienen al
-- día cuando se renombra el artículo o la receta, venga el cambio de donde
-- venga (ficha, albarán, fusión de duplicados...).

CREATE OR REPLACE FUNCTION portion_counter_name_from_product() RETURNS trigger AS $$
BEGIN
  UPDATE "portion_counters" SET "name" = NEW."name" WHERE "productId" = NEW."id";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION portion_counter_name_from_recipe() RETURNS trigger AS $$
BEGIN
  UPDATE "portion_counters" SET "name" = NEW."name" WHERE "recipeId" = NEW."id";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "products_rename_portion_counter"
AFTER UPDATE OF "name" ON "products"
FOR EACH ROW WHEN (OLD."name" IS DISTINCT FROM NEW."name")
EXECUTE FUNCTION portion_counter_name_from_product();

CREATE TRIGGER "recipes_rename_portion_counter"
AFTER UPDATE OF "name" ON "recipes"
FOR EACH ROW WHEN (OLD."name" IS DISTINCT FROM NEW."name")
EXECUTE FUNCTION portion_counter_name_from_recipe();

-- Puesta al día de los contadores existentes (incluye los artículos que la
-- migración anterior acaba de pasar a «Primera en mayúscula»).
UPDATE "portion_counters" c SET "name" = p."name"
FROM "products" p WHERE c."productId" = p."id" AND c."name" IS DISTINCT FROM p."name";

UPDATE "portion_counters" c SET "name" = r."name"
FROM "recipes" r WHERE c."recipeId" = r."id" AND c."name" IS DISTINCT FROM r."name";
