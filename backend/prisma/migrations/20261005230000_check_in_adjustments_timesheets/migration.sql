-- Check-In: correcciones de fichajes y hojas de horas. Solo aditivo. Las
-- cuatro tablas son evidencia inalterable (append-only): una correccion o una
-- hoja aprobada nunca se edita; se anade una fila nueva.

-- CreateEnum
CREATE TYPE "PunchAdjustmentKind" AS ENUM ('ADD', 'VOID', 'REPLACE', 'CONFIRM');

-- CreateEnum
CREATE TYPE "PunchAdjustmentStatus" AS ENUM ('APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "time_punch_adjustments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "kind" "PunchAdjustmentKind" NOT NULL,
    "targetPunchId" TEXT,
    "type" "PunchType",
    "occurredAt" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_punch_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_punch_adjustment_decisions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "adjustmentId" TEXT NOT NULL,
    "status" "PunchAdjustmentStatus" NOT NULL,
    "note" TEXT,
    "decidedByUserId" TEXT NOT NULL,
    "decidedByName" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_punch_adjustment_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "workedMinutes" INTEGER NOT NULL,
    "breakMinutes" INTEGER NOT NULL,
    "expectedMinutes" INTEGER NOT NULL,
    "overtimeMinutes" INTEGER NOT NULL,
    "daysWorked" INTEGER NOT NULL,
    "incidenceCount" INTEGER NOT NULL,
    "detail" JSONB NOT NULL,
    "reopenReason" TEXT,
    "approvedByUserId" TEXT NOT NULL,
    "approvedByName" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timesheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheet_acks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "timesheetId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "ackAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timesheet_acks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "time_punch_adjustments_tenantId_employeeId_idx" ON "time_punch_adjustments"("tenantId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "time_punch_adjustment_decisions_adjustmentId_key" ON "time_punch_adjustment_decisions"("adjustmentId");

-- CreateIndex
CREATE INDEX "time_punch_adjustment_decisions_tenantId_idx" ON "time_punch_adjustment_decisions"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "timesheets_tenantId_employeeId_year_month_version_key" ON "timesheets"("tenantId", "employeeId", "year", "month", "version");

-- CreateIndex
CREATE UNIQUE INDEX "timesheet_acks_timesheetId_key" ON "timesheet_acks"("timesheetId");

-- CreateIndex
CREATE INDEX "timesheet_acks_tenantId_employeeId_idx" ON "timesheet_acks"("tenantId", "employeeId");

-- Inalterabilidad
CREATE TRIGGER trg_forbid_mutation
  BEFORE UPDATE OR DELETE ON "time_punch_adjustments"
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER trg_forbid_mutation
  BEFORE UPDATE OR DELETE ON "time_punch_adjustment_decisions"
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER trg_forbid_mutation
  BEFORE UPDATE OR DELETE ON "timesheets"
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER trg_forbid_mutation
  BEFORE UPDATE OR DELETE ON "timesheet_acks"
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
