-- CreateTable
CREATE TABLE "purchase_schedules" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "locationId" TEXT,
    "daysOfWeek" INTEGER[],
    "timeOfDay" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "purchase_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "purchase_schedules_tenantId_enabled_idx" ON "purchase_schedules"("tenantId", "enabled");

-- AddForeignKey
ALTER TABLE "purchase_schedules" ADD CONSTRAINT "purchase_schedules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_schedules" ADD CONSTRAINT "purchase_schedules_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_schedules" ADD CONSTRAINT "purchase_schedules_listId_fkey" FOREIGN KEY ("listId") REFERENCES "purchase_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_schedules" ADD CONSTRAINT "purchase_schedules_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
