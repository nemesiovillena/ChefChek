-- CreateTable
CREATE TABLE "product_duplicate_dismissals" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "dismissedProductId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_duplicate_dismissals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_duplicate_dismissals_tenantId_dismissedProductId_idx" ON "product_duplicate_dismissals"("tenantId", "dismissedProductId");

-- CreateIndex
CREATE UNIQUE INDEX "product_duplicate_dismissals_tenantId_productId_dismissedPr_key" ON "product_duplicate_dismissals"("tenantId", "productId", "dismissedProductId");

-- AddForeignKey
ALTER TABLE "product_duplicate_dismissals" ADD CONSTRAINT "product_duplicate_dismissals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_duplicate_dismissals" ADD CONSTRAINT "product_duplicate_dismissals_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_duplicate_dismissals" ADD CONSTRAINT "product_duplicate_dismissals_dismissedProductId_fkey" FOREIGN KEY ("dismissedProductId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
