-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "closedWeekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- CreateTable
CREATE TABLE "tenant_calendar_exceptions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fromDay" TEXT NOT NULL,
    "toDay" TEXT NOT NULL,
    "reason" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_calendar_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenant_calendar_exceptions_tenantId_idx" ON "tenant_calendar_exceptions"("tenantId");

-- AddForeignKey
ALTER TABLE "tenant_calendar_exceptions" ADD CONSTRAINT "tenant_calendar_exceptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
