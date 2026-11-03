-- Nombres de artículo enteros en MAYÚSCULAS (leídos de albaranes) pasan a
-- «Primera en mayúscula» («TOMATE PERA 1KG» → «Tomate pera 1kg»). Los nombres
-- que ya mezclan mayúsculas y minúsculas no se tocan. Misma regla que
-- normalizeProductNameCase() al crear artículos nuevos.
--
-- Antes de cambiar nada se copia cada nombre original en
-- product_name_case_backups, para poder deshacerlo:
--   UPDATE products p SET name = b.name
--   FROM product_name_case_backups b WHERE b."productId" = p.id;

CREATE TABLE "product_name_case_backups" (
    "productId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "backedUpAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_name_case_backups_pkey" PRIMARY KEY ("productId")
);

INSERT INTO "product_name_case_backups" ("productId", "tenantId", "name")
SELECT "id", "tenantId", "name"
FROM "products"
WHERE "name" = upper("name") AND "name" <> lower("name");

UPDATE "products" p
SET "name" = upper(left(lower(p."name"), 1)) || substr(lower(p."name"), 2)
FROM "product_name_case_backups" b
WHERE b."productId" = p."id";
