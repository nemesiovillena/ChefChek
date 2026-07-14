-- CreateTable
CREATE TABLE "purchase_lists" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "locationId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "purchase_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_list_items" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "defaultQuantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "purchase_lists_tenantId_supplierId_idx" ON "purchase_lists"("tenantId", "supplierId");

-- CreateIndex
CREATE INDEX "purchase_list_items_productId_idx" ON "purchase_list_items"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_list_items_listId_productId_key" ON "purchase_list_items"("listId", "productId");

-- AddForeignKey
ALTER TABLE "purchase_lists" ADD CONSTRAINT "purchase_lists_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_lists" ADD CONSTRAINT "purchase_lists_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_lists" ADD CONSTRAINT "purchase_lists_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_list_items" ADD CONSTRAINT "purchase_list_items_listId_fkey" FOREIGN KEY ("listId") REFERENCES "purchase_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_list_items" ADD CONSTRAINT "purchase_list_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
