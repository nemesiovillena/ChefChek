-- CreateTable
CREATE TABLE "supplier_product_aliases" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "normalizedDescription" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "confirmedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_product_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_product_aliases_productId_idx" ON "supplier_product_aliases"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_product_aliases_tenantId_supplierId_normalizedDesc_key" ON "supplier_product_aliases"("tenantId", "supplierId", "normalizedDescription");

-- AddForeignKey
ALTER TABLE "supplier_product_aliases" ADD CONSTRAINT "supplier_product_aliases_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_product_aliases" ADD CONSTRAINT "supplier_product_aliases_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_product_aliases" ADD CONSTRAINT "supplier_product_aliases_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
