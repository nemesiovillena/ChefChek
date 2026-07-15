-- AlterTable
ALTER TABLE "albaranes" ADD COLUMN     "purchaseOrderId" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "albaranId" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "fileUrl" TEXT,
ADD COLUMN     "purchaseOrderId" TEXT;

-- CreateIndex
CREATE INDEX "albaranes_purchaseOrderId_idx" ON "albaranes"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "invoices_albaranId_idx" ON "invoices"("albaranId");

-- CreateIndex
CREATE INDEX "invoices_purchaseOrderId_idx" ON "invoices"("purchaseOrderId");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_albaranId_fkey" FOREIGN KEY ("albaranId") REFERENCES "albaranes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "albaranes" ADD CONSTRAINT "albaranes_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
