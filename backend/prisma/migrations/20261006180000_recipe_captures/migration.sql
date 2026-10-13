-- CreateEnum
CREATE TYPE "RecipeCaptureStatus" AS ENUM ('PROCESANDO', 'PENDIENTE', 'ERROR', 'PASANDO', 'PASADA', 'DESCARTADA');

-- CreateEnum
CREATE TYPE "RecipeCaptureSource" AS ENUM ('URL', 'TEXTO', 'ARCHIVO');

-- CreateTable
CREATE TABLE "recipe_captures" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "source" "RecipeCaptureSource" NOT NULL,
    "sourceUrl" TEXT,
    "sourceFileName" TEXT,
    "sourceText" TEXT,
    "status" "RecipeCaptureStatus" NOT NULL DEFAULT 'PROCESANDO',
    "errorMessage" TEXT,
    "createdBy" TEXT,
    "name" TEXT,
    "description" TEXT,
    "elaboration" TEXT,
    "portions" DOUBLE PRECISION,
    "preparationTimeMinutes" INTEGER,
    "cookingTimeMinutes" INTEGER,
    "reservedRecipeId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "recipeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipe_captures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_capture_ingredients" (
    "id" TEXT NOT NULL,
    "captureId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "note" TEXT,
    "matchedProductId" TEXT,
    "matchConfidence" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "recipe_capture_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recipe_captures_tenantId_status_idx" ON "recipe_captures"("tenantId", "status");

-- CreateIndex
CREATE INDEX "recipe_capture_ingredients_captureId_idx" ON "recipe_capture_ingredients"("captureId");

-- CreateIndex
CREATE INDEX "recipe_capture_ingredients_matchedProductId_idx" ON "recipe_capture_ingredients"("matchedProductId");

-- AddForeignKey
ALTER TABLE "recipe_captures" ADD CONSTRAINT "recipe_captures_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_captures" ADD CONSTRAINT "recipe_captures_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_capture_ingredients" ADD CONSTRAINT "recipe_capture_ingredients_captureId_fkey" FOREIGN KEY ("captureId") REFERENCES "recipe_captures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_capture_ingredients" ADD CONSTRAINT "recipe_capture_ingredients_matchedProductId_fkey" FOREIGN KEY ("matchedProductId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

