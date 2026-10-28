-- Una sola merma por artículo: la merma escrita en líneas de receta pasa a
-- Product y la línea deja de guardarla (wastePercentageOverride queda null).
--
-- Se copian solo mermas > 0 que difieren de la del artículo: un 0 en la línea
-- lo dejaba el formulario al congelar la merma vieja del artículo, no el
-- usuario. Si varias recetas dan cifras distintas para el mismo artículo,
-- gana la de la receta editada más recientemente. Derivados igual que ProductsService.update: yieldFactor,
-- netPrice y, con prueba de rendimiento, netWeight.
WITH recipe_waste AS (
  SELECT DISTINCT ON (ri."productId")
         ri."productId", ri."wastePercentageOverride" AS waste
  FROM recipe_ingredients ri
  JOIN recipes r ON r.id = ri."recipeId"
  WHERE r."deletedAt" IS NULL
    AND ri."wastePercentageOverride" > 0
    AND ri."wastePercentageOverride" < 100
  ORDER BY ri."productId", r."updatedAt" DESC
)
UPDATE products p
SET "wastePercentage" = rw.waste,
    "yieldFactor" = (100 - rw.waste) / 100,
    "netPrice" = ROUND(
      (p."purchasePrice" * (1 - rw.waste / 100) * (1 + COALESCE(p."profitMargin", 0) / 100))::numeric,
      2
    )::float8,
    "netWeight" = CASE
      WHEN p."grossWeight" > 0 THEN p."grossWeight" * (100 - rw.waste) / 100
      ELSE p."netWeight"
    END
FROM recipe_waste rw
WHERE p.id = rw."productId"
  AND ABS(COALESCE(p."wastePercentage", 0) - rw.waste) >= 0.005;

UPDATE recipe_ingredients
SET "wastePercentageOverride" = NULL
WHERE "wastePercentageOverride" IS NOT NULL;
