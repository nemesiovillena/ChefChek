-- CreateEnum
CREATE TYPE "PortionMovementType" AS ENUM ('LABEL_IN', 'LABEL_EDIT', 'SALE', 'RETIRE', 'UNRETIRE', 'VOID', 'ADJUST', 'RECOUNT');

-- AlterTable
ALTER TABLE "food_labels" ADD COLUMN     "portionCounterId" TEXT,
ADD COLUMN     "portionsExpiryAckAt" TIMESTAMP(3),
ADD COLUMN     "portionsRemaining" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "portion_counters" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "recipeId" TEXT,
    "productId" TEXT,
    "minPortions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unlabeledPortions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "belowMinNotifiedAt" TIMESTAMP(3),
    "outNotifiedAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portion_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portion_counter_dishes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "counterId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "producto" TEXT NOT NULL,
    "portionsPerSale" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portion_counter_dishes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portion_movements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "counterId" TEXT NOT NULL,
    "foodLabelId" TEXT,
    "type" "PortionMovementType" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "shortfall" BOOLEAN NOT NULL DEFAULT false,
    "cuinerSaleLineId" TEXT,
    "reason" TEXT,
    "userId" TEXT,
    "userName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portion_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "portion_counters_tenantId_idx" ON "portion_counters"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "portion_counters_tenantId_recipeId_key" ON "portion_counters"("tenantId", "recipeId");

-- CreateIndex
CREATE UNIQUE INDEX "portion_counters_tenantId_productId_key" ON "portion_counters"("tenantId", "productId");

-- CreateIndex
CREATE INDEX "portion_counter_dishes_counterId_idx" ON "portion_counter_dishes"("counterId");

-- CreateIndex
CREATE UNIQUE INDEX "portion_counter_dishes_tenantId_tipo_producto_key" ON "portion_counter_dishes"("tenantId", "tipo", "producto");

-- CreateIndex
CREATE INDEX "portion_movements_tenantId_counterId_createdAt_idx" ON "portion_movements"("tenantId", "counterId", "createdAt");

-- CreateIndex
CREATE INDEX "portion_movements_foodLabelId_idx" ON "portion_movements"("foodLabelId");

-- CreateIndex
CREATE INDEX "portion_movements_cuinerSaleLineId_idx" ON "portion_movements"("cuinerSaleLineId");

-- CreateIndex
CREATE INDEX "food_labels_portionCounterId_idx" ON "food_labels"("portionCounterId");

-- AddForeignKey
ALTER TABLE "portion_counter_dishes" ADD CONSTRAINT "portion_counter_dishes_counterId_fkey" FOREIGN KEY ("counterId") REFERENCES "portion_counters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portion_movements" ADD CONSTRAINT "portion_movements_counterId_fkey" FOREIGN KEY ("counterId") REFERENCES "portion_counters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

