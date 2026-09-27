-- AlterTable
ALTER TABLE "food_labels"
  ADD COLUMN "retiredAt" TIMESTAMP(3),
  ADD COLUMN "retiredDisposition" TEXT,
  ADD COLUMN "retiredByUserId" TEXT,
  ADD COLUMN "retiredByName" TEXT;

-- CreateIndex
CREATE INDEX "food_labels_tenantId_retiredAt_idx" ON "food_labels"("tenantId", "retiredAt");
