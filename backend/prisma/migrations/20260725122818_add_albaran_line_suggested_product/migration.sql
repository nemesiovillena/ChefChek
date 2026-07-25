-- AlterTable
ALTER TABLE "albaran_lines" ADD COLUMN     "suggestedProductId" TEXT,
ADD COLUMN     "suggestionDismissed" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "albaran_lines_suggestedProductId_idx" ON "albaran_lines"("suggestedProductId");

-- AddForeignKey
ALTER TABLE "albaran_lines" ADD CONSTRAINT "albaran_lines_suggestedProductId_fkey" FOREIGN KEY ("suggestedProductId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
