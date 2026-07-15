-- CreateEnum
CREATE TYPE "PriceDeviationStatus" AS ENUM ('PENDIENTE', 'RECLAMADA', 'RESUELTA');

-- AlterTable
ALTER TABLE "product_supplier_offers" ADD COLUMN     "agreedAt" TIMESTAMP(3),
ADD COLUMN     "agreedPrice" DOUBLE PRECISION,
ADD COLUMN     "agreedUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "price_deviations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "albaranId" TEXT,
    "purchaseOrderId" TEXT,
    "agreedPrice" DOUBLE PRECISION NOT NULL,
    "receivedPrice" DOUBLE PRECISION NOT NULL,
    "deviationPercent" DOUBLE PRECISION NOT NULL,
    "status" "PriceDeviationStatus" NOT NULL DEFAULT 'PENDIENTE',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "price_deviations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "price_deviations_tenantId_status_idx" ON "price_deviations"("tenantId", "status");

-- CreateIndex
CREATE INDEX "price_deviations_offerId_idx" ON "price_deviations"("offerId");

-- CreateIndex
CREATE INDEX "price_deviations_albaranId_idx" ON "price_deviations"("albaranId");

-- CreateIndex
CREATE INDEX "price_deviations_purchaseOrderId_idx" ON "price_deviations"("purchaseOrderId");

-- AddForeignKey
ALTER TABLE "price_deviations" ADD CONSTRAINT "price_deviations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_deviations" ADD CONSTRAINT "price_deviations_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "product_supplier_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_deviations" ADD CONSTRAINT "price_deviations_albaranId_fkey" FOREIGN KEY ("albaranId") REFERENCES "albaranes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_deviations" ADD CONSTRAINT "price_deviations_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
