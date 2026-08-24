-- AlterTable
ALTER TABLE "production_orders" ADD COLUMN "assignedStaffIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
