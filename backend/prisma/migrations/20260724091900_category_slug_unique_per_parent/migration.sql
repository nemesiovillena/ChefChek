-- DropIndex
DROP INDEX "categories_tenantId_context_slug_key";

-- CreateIndex
CREATE UNIQUE INDEX "categories_tenantId_context_parentId_slug_key" ON "categories"("tenantId", "context", "parentId", "slug");
