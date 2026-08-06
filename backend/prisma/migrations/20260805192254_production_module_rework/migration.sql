-- DropForeignKey
ALTER TABLE "progress_trackings" DROP CONSTRAINT "progress_trackings_workBatchId_fkey";

-- DropForeignKey
ALTER TABLE "task_assignments" DROP CONSTRAINT "task_assignments_taskId_fkey";

-- AlterTable
ALTER TABLE "mise_en_place_items" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "production_alerts" ADD COLUMN     "orderId" TEXT NOT NULL,
ADD COLUMN     "resolution" TEXT;

-- AlterTable
ALTER TABLE "production_orders" DROP COLUMN "miseEnPlaceItems",
ADD COLUMN     "batchId" TEXT NOT NULL,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "estimatedTime" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "quantity" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "recipeId" TEXT NOT NULL,
ADD COLUMN     "recipeName" TEXT NOT NULL,
ADD COLUMN     "unit" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "progress_trackings" DROP COLUMN "notes",
DROP COLUMN "progress",
DROP COLUMN "taskId",
DROP COLUMN "trackedAt",
DROP COLUMN "trackedBy",
DROP COLUMN "workBatchId",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "orderId" TEXT NOT NULL,
ADD COLUMN     "overallProgress" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "timeElapsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "timeRemaining" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'ON_SCHEDULE';

-- AlterTable
ALTER TABLE "task_assignments" ADD COLUMN     "actualTime" DOUBLE PRECISION,
ADD COLUMN     "orderId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "work_batches" DROP COLUMN "orderId",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "kitchenZone" TEXT NOT NULL DEFAULT 'HOT_KITCHEN',
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "responsible" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "production_tasks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "estimatedTime" DOUBLE PRECISION NOT NULL,
    "dependencies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestones" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percentage" INTEGER NOT NULL,
    "scheduledTime" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_reports" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "totalOrders" INTEGER NOT NULL,
    "completedOrders" INTEGER NOT NULL,
    "completionRate" DOUBLE PRECISION NOT NULL,
    "avgActualTime" DOUBLE PRECISION NOT NULL,
    "avgEstimatedTime" DOUBLE PRECISION NOT NULL,
    "efficiency" DOUBLE PRECISION NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "progress_trackings_orderId_key" ON "progress_trackings"("orderId");

-- AddForeignKey
ALTER TABLE "production_tasks" ADD CONSTRAINT "production_tasks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_tasks" ADD CONSTRAINT "production_tasks_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "production_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_trackings" ADD CONSTRAINT "progress_trackings_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "work_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_alerts" ADD CONSTRAINT "production_alerts_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mise_en_place_sheets" ADD CONSTRAINT "mise_en_place_sheets_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "work_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mise_en_place_items" ADD CONSTRAINT "mise_en_place_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_reports" ADD CONSTRAINT "production_reports_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_reports" ADD CONSTRAINT "production_reports_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "work_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

