-- CreateEnum
CREATE TYPE "CatalogImportStatus" AS ENUM ('PENDIENTE', 'APLICADO', 'DESCARTADO');

-- CreateEnum
CREATE TYPE "CatalogLineStatus" AS ENUM ('PROPUESTA', 'ACEPTADA', 'RECHAZADA');

-- CreateTable
CREATE TABLE "offer_location_settings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offer_location_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_imports" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "fileUrl" TEXT,
    "aiModel" TEXT,
    "status" "CatalogImportStatus" NOT NULL DEFAULT 'PENDIENTE',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "catalog_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_import_lines" (
    "id" TEXT NOT NULL,
    "catalogImportId" TEXT NOT NULL,
    "rawName" TEXT NOT NULL,
    "articleNumber" TEXT,
    "purchaseFormat" TEXT,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "matchedProductId" TEXT,
    "matchStatus" "LineMatchStatus" NOT NULL DEFAULT 'NUEVO',
    "lineStatus" "CatalogLineStatus" NOT NULL DEFAULT 'PROPUESTA',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_import_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "offer_location_settings_tenantId_idx" ON "offer_location_settings"("tenantId");

-- CreateIndex
CREATE INDEX "offer_location_settings_locationId_idx" ON "offer_location_settings"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "offer_location_settings_offerId_locationId_key" ON "offer_location_settings"("offerId", "locationId");

-- CreateIndex
CREATE INDEX "catalog_imports_tenantId_supplierId_idx" ON "catalog_imports"("tenantId", "supplierId");

-- CreateIndex
CREATE INDEX "catalog_import_lines_catalogImportId_idx" ON "catalog_import_lines"("catalogImportId");

-- CreateIndex
CREATE INDEX "catalog_import_lines_matchedProductId_idx" ON "catalog_import_lines"("matchedProductId");

-- AddForeignKey
ALTER TABLE "offer_location_settings" ADD CONSTRAINT "offer_location_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_location_settings" ADD CONSTRAINT "offer_location_settings_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "product_supplier_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_location_settings" ADD CONSTRAINT "offer_location_settings_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_imports" ADD CONSTRAINT "catalog_imports_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_imports" ADD CONSTRAINT "catalog_imports_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_import_lines" ADD CONSTRAINT "catalog_import_lines_catalogImportId_fkey" FOREIGN KEY ("catalogImportId") REFERENCES "catalog_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_import_lines" ADD CONSTRAINT "catalog_import_lines_matchedProductId_fkey" FOREIGN KEY ("matchedProductId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
