-- Portal del empleado: solicitudes de cambio de datos y peticiones libres.
-- Solo aditivo.

-- CreateEnum
CREATE TYPE "EmployeeRequestKind" AS ENUM ('DATA_CHANGE', 'OTHER');

-- CreateEnum
CREATE TYPE "EmployeeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "employee_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "kind" "EmployeeRequestKind" NOT NULL,
    "payload" JSONB,
    "message" TEXT,
    "status" "EmployeeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decisionNote" TEXT,
    "decidedByUserId" TEXT,
    "decidedByName" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_requests_tenantId_status_idx" ON "employee_requests"("tenantId", "status");

-- CreateIndex
CREATE INDEX "employee_requests_tenantId_employeeId_idx" ON "employee_requests"("tenantId", "employeeId");

-- AddForeignKey
ALTER TABLE "employee_requests" ADD CONSTRAINT "employee_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
