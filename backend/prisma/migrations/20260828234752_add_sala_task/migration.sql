-- CreateTable
CREATE TABLE "sala_tasks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "guestCount" INTEGER,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "menuNotes" TEXT,
    "observations" TEXT,
    "allergies" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "sala_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sala_tasks_tenantId_status_sortOrder_idx" ON "sala_tasks"("tenantId", "status", "sortOrder");

-- AddForeignKey
ALTER TABLE "sala_tasks" ADD CONSTRAINT "sala_tasks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

