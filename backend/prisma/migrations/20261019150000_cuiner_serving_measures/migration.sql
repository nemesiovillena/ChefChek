-- AlterTable
ALTER TABLE "cuiner_dish_maps" ADD COLUMN     "servingMeasureId" TEXT;

-- CreateTable
CREATE TABLE "serving_measures" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "serving_measures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "serving_measures_tenantId_name_key" ON "serving_measures"("tenantId", "name");

-- CreateIndex
CREATE INDEX "cuiner_dish_maps_tenantId_servingMeasureId_idx" ON "cuiner_dish_maps"("tenantId", "servingMeasureId");

