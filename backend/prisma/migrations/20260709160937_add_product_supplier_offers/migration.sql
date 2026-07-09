-- CreateTable
CREATE TABLE "product_supplier_offers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "purchaseFormat" TEXT NOT NULL DEFAULT '',
    "referenceUnit" TEXT NOT NULL DEFAULT 'kg',
    "unitsPerFormat" INTEGER NOT NULL DEFAULT 1,
    "referenceUnitSize" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitSize" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "purchasePrice" DOUBLE PRECISION NOT NULL,
    "previousPurchasePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netPrice" DOUBLE PRECISION NOT NULL,
    "profitMargin" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "product_supplier_offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_supplier_offers_tenantId_idx" ON "product_supplier_offers"("tenantId");

-- CreateIndex
CREATE INDEX "product_supplier_offers_productId_idx" ON "product_supplier_offers"("productId");

-- CreateIndex
CREATE INDEX "product_supplier_offers_supplierId_idx" ON "product_supplier_offers"("supplierId");

-- AddForeignKey
ALTER TABLE "product_supplier_offers" ADD CONSTRAINT "product_supplier_offers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_supplier_offers" ADD CONSTRAINT "product_supplier_offers_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_supplier_offers" ADD CONSTRAINT "product_supplier_offers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: cada producto con proveedor conocido conserva esa relación como
-- oferta preferente, para no perder ningún dato al introducir el nuevo modelo.
-- gen_random_uuid() es una función nativa desde PostgreSQL 13 (no requiere
-- CREATE EXTENSION pgcrypto).
INSERT INTO "product_supplier_offers" (
  "id", "tenantId", "productId", "supplierId",
  "purchaseFormat", "referenceUnit", "unitsPerFormat", "referenceUnitSize", "unitSize",
  "purchasePrice", "previousPurchasePrice", "netPrice", "profitMargin",
  "isPreferred", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text, p."tenantId", p."id", p."supplierId",
  p."purchaseFormat", p."referenceUnit", p."unitsPerFormat", p."referenceUnitSize", p."unitSize",
  p."purchasePrice", p."previousPurchasePrice", p."netPrice", p."profitMargin",
  true, now(), now()
FROM "products" p
WHERE p."supplierId" IS NOT NULL AND p."deletedAt" IS NULL;

-- Máximo 1 oferta preferente activa (no soft-deleted) por producto.
CREATE UNIQUE INDEX "product_supplier_offers_preferred_unique"
  ON "product_supplier_offers" ("productId")
  WHERE "isPreferred" = true AND "deletedAt" IS NULL;

-- Máximo 1 oferta activa (no soft-deleted) por producto+proveedor.
CREATE UNIQUE INDEX "product_supplier_offers_product_supplier_unique"
  ON "product_supplier_offers" ("productId", "supplierId")
  WHERE "deletedAt" IS NULL;
