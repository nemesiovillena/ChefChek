-- Turnos y ausencias: tipos de ausencia, ausencias, saldos de vacaciones y
-- festivos. Solo aditivo.

-- CreateEnum
CREATE TYPE "AbsenceStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "absence_types" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6b7280',
    "deductsVacation" BOOLEAN NOT NULL DEFAULT false,
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "employeeCanRequest" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "absence_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "absences" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "absenceTypeId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "halfDay" BOOLEAN NOT NULL DEFAULT false,
    "status" "AbsenceStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "requestedByUserId" TEXT NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "decidedByUserId" TEXT,
    "decidedByName" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "absences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_balances" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "entitledDays" DOUBLE PRECISION NOT NULL,
    "carriedOverDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "adjustmentDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "absence_types_tenantId_name_key" ON "absence_types"("tenantId", "name");

-- CreateIndex
CREATE INDEX "absences_tenantId_startDate_idx" ON "absences"("tenantId", "startDate");

-- CreateIndex
CREATE INDEX "absences_tenantId_employeeId_idx" ON "absences"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "leave_balances_tenantId_idx" ON "leave_balances"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "leave_balances_employeeId_year_key" ON "leave_balances"("employeeId", "year");

-- CreateIndex
CREATE INDEX "holidays_tenantId_date_idx" ON "holidays"("tenantId", "date");

-- AddForeignKey
ALTER TABLE "absences" ADD CONSTRAINT "absences_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absences" ADD CONSTRAINT "absences_absenceTypeId_fkey" FOREIGN KEY ("absenceTypeId") REFERENCES "absence_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
