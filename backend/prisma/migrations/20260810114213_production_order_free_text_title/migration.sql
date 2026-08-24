-- AlterTable
ALTER TABLE "production_orders" ALTER COLUMN "recipeId" DROP NOT NULL;
ALTER TABLE "production_orders" ALTER COLUMN "recipeName" DROP NOT NULL;
ALTER TABLE "production_orders" ALTER COLUMN "quantity" DROP NOT NULL;
ALTER TABLE "production_orders" ALTER COLUMN "unit" DROP NOT NULL;

ALTER TABLE "production_orders" ADD COLUMN "title" TEXT;
UPDATE "production_orders" SET "title" = "recipeName" WHERE "title" IS NULL;
ALTER TABLE "production_orders" ALTER COLUMN "title" SET NOT NULL;

ALTER TABLE "production_orders" ADD COLUMN "description" TEXT;
