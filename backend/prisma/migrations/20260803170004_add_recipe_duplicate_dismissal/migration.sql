-- CreateTable
CREATE TABLE "recipe_duplicate_dismissals" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "dismissedRecipeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_duplicate_dismissals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recipe_duplicate_dismissals_tenantId_dismissedRecipeId_idx" ON "recipe_duplicate_dismissals"("tenantId", "dismissedRecipeId");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_duplicate_dismissals_tenantId_recipeId_dismissedReci_key" ON "recipe_duplicate_dismissals"("tenantId", "recipeId", "dismissedRecipeId");

-- AddForeignKey
ALTER TABLE "recipe_duplicate_dismissals" ADD CONSTRAINT "recipe_duplicate_dismissals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_duplicate_dismissals" ADD CONSTRAINT "recipe_duplicate_dismissals_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_duplicate_dismissals" ADD CONSTRAINT "recipe_duplicate_dismissals_dismissedRecipeId_fkey" FOREIGN KEY ("dismissedRecipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
