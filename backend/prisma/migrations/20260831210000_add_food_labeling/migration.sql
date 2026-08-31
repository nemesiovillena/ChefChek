-- AlterTable
ALTER TABLE "products" ADD COLUMN     "secondaryShelfLifeDays" INTEGER,
ADD COLUMN     "shelfLifeFrozenDays" INTEGER,
ADD COLUMN     "storageCondition" TEXT,
ADD COLUMN     "storageTempMax" DOUBLE PRECISION,
ADD COLUMN     "storageTempMin" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "recipes" ADD COLUMN     "shelfLifeDays" INTEGER,
ADD COLUMN     "shelfLifeFrozenDays" INTEGER,
ADD COLUMN     "storageCondition" TEXT,
ADD COLUMN     "storageTempMax" DOUBLE PRECISION,
ADD COLUMN     "storageTempMin" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "food_labels" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "labelType" TEXT NOT NULL,
    "recipeId" TEXT,
    "productId" TEXT,
    "itemName" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "sourceLotId" TEXT,
    "productionOrderId" TEXT,
    "preparedAt" TIMESTAMP(3) NOT NULL,
    "manufacturerExpiryDate" TIMESTAMP(3),
    "useByDate" TIMESTAMP(3) NOT NULL,
    "frozenAt" TIMESTAMP(3),
    "frozenUseByDate" TIMESTAMP(3),
    "storageCondition" TEXT NOT NULL,
    "storageTempMin" DOUBLE PRECISION,
    "storageTempMax" DOUBLE PRECISION,
    "shelfLifeDaysApplied" INTEGER,
    "quantity" DOUBLE PRECISION,
    "quantityUnit" TEXT,
    "portions" DOUBLE PRECISION,
    "allergens" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "reprintCount" INTEGER NOT NULL DEFAULT 0,
    "qrToken" TEXT NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "food_labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_label_ingredient_lots" (
    "id" TEXT NOT NULL,
    "foodLabelId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "lotId" TEXT,
    "lotNumber" TEXT NOT NULL,
    "quantityUsed" DOUBLE PRECISION,
    "unit" TEXT,

    CONSTRAINT "food_label_ingredient_lots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "food_labels_qrToken_key" ON "food_labels"("qrToken");

-- CreateIndex
CREATE INDEX "food_labels_tenantId_idx" ON "food_labels"("tenantId");

-- CreateIndex
CREATE INDEX "food_labels_tenantId_preparedAt_idx" ON "food_labels"("tenantId", "preparedAt");

-- CreateIndex
CREATE INDEX "food_labels_recipeId_idx" ON "food_labels"("recipeId");

-- CreateIndex
CREATE INDEX "food_labels_productId_idx" ON "food_labels"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "food_labels_tenantId_lotNumber_key" ON "food_labels"("tenantId", "lotNumber");

-- CreateIndex
CREATE INDEX "food_label_ingredient_lots_foodLabelId_idx" ON "food_label_ingredient_lots"("foodLabelId");

-- AddForeignKey
ALTER TABLE "food_labels" ADD CONSTRAINT "food_labels_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_labels" ADD CONSTRAINT "food_labels_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_labels" ADD CONSTRAINT "food_labels_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_labels" ADD CONSTRAINT "food_labels_sourceLotId_fkey" FOREIGN KEY ("sourceLotId") REFERENCES "lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_labels" ADD CONSTRAINT "food_labels_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_label_ingredient_lots" ADD CONSTRAINT "food_label_ingredient_lots_foodLabelId_fkey" FOREIGN KEY ("foodLabelId") REFERENCES "food_labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_label_ingredient_lots" ADD CONSTRAINT "food_label_ingredient_lots_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_label_ingredient_lots" ADD CONSTRAINT "food_label_ingredient_lots_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

