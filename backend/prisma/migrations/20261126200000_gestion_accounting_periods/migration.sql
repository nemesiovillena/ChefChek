-- CreateTable
CREATE TABLE "gestion_accounting_periods" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodFrom" DATE NOT NULL,
    "periodTo" DATE NOT NULL,
    "sales" DOUBLE PRECISION NOT NULL,
    "purchases" DOUBLE PRECISION NOT NULL,
    "labor" DOUBLE PRECISION NOT NULL,
    "overheads" DOUBLE PRECISION NOT NULL,
    "financial" DOUBLE PRECISION NOT NULL,
    "result" DOUBLE PRECISION NOT NULL,
    "fileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gestion_accounting_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gestion_accounting_periods_tenantId_periodFrom_periodTo_key" ON "gestion_accounting_periods"("tenantId", "periodFrom", "periodTo");
