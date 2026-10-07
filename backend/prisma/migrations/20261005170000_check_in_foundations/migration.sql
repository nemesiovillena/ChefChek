-- Check-In (control horario): fundaciones. Solo aditivo: ficha laboral de
-- empleado, asignación a centros, ajustes del módulo por tenant, textos
-- legales versionados y campos de geovalla en "locations".

-- CreateEnum
CREATE TYPE "GeofenceMode" AS ENUM ('OFF', 'WARN', 'BLOCK');

-- CreateEnum
CREATE TYPE "VacationDayType" AS ENUM ('NATURAL', 'WORKING');

-- CreateEnum
CREATE TYPE "CheckInLegalTextKind" AS ENUM ('REGISTRO_JORNADA_INFO', 'GEOLOCALIZACION', 'PROTOCOLO_REGISTRO');

-- AlterTable
ALTER TABLE "locations" ADD COLUMN     "geofenceMode" "GeofenceMode" NOT NULL DEFAULT 'WARN',
ADD COLUMN     "geofenceRadiusM" INTEGER NOT NULL DEFAULT 150,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Europe/Madrid';

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "nationalId" TEXT,
    "socialSecurityNumber" TEXT,
    "jobTitle" TEXT,
    "section" TEXT,
    "contractType" TEXT,
    "weeklyHours" DOUBLE PRECISION NOT NULL DEFAULT 40,
    "hourlyCost" DOUBLE PRECISION,
    "defaultLocationId" TEXT,
    "hireDate" TIMESTAMP(3),
    "terminationDate" TIMESTAMP(3),
    "pinHash" TEXT,
    "pinFailedAttempts" INTEGER NOT NULL DEFAULT 0,
    "pinLockedUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_locations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_in_settings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agreementKey" TEXT NOT NULL DEFAULT 'personalizado-et',
    "annualHours" DOUBLE PRECISION NOT NULL DEFAULT 1826,
    "weeklyHours" DOUBLE PRECISION NOT NULL DEFAULT 40,
    "maxDailyHours" DOUBLE PRECISION NOT NULL DEFAULT 9,
    "minRestBetweenShiftsHours" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "weeklyRestDays" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "nightStart" TEXT NOT NULL DEFAULT '22:00',
    "nightEnd" TEXT NOT NULL DEFAULT '06:00',
    "vacationDays" INTEGER NOT NULL DEFAULT 30,
    "vacationDayType" "VacationDayType" NOT NULL DEFAULT 'NATURAL',
    "overtimeYearlyCap" DOUBLE PRECISION NOT NULL DEFAULT 80,
    "breaksCountAsWork" BOOLEAN NOT NULL DEFAULT false,
    "autoCloseAfterHours" INTEGER NOT NULL DEFAULT 14,
    "pinLength" INTEGER NOT NULL DEFAULT 4,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "check_in_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_in_legal_texts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" "CheckInLegalTextKind" NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "validatedByUserId" TEXT,
    "validatedByName" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "check_in_legal_texts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_userId_key" ON "employees"("userId");

-- CreateIndex
CREATE INDEX "employees_tenantId_idx" ON "employees"("tenantId");

-- CreateIndex
CREATE INDEX "employee_locations_tenantId_idx" ON "employee_locations"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "employee_locations_employeeId_locationId_key" ON "employee_locations"("employeeId", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "check_in_settings_tenantId_key" ON "check_in_settings"("tenantId");

-- CreateIndex
CREATE INDEX "check_in_legal_texts_tenantId_idx" ON "check_in_legal_texts"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "check_in_legal_texts_tenantId_kind_version_key" ON "check_in_legal_texts"("tenantId", "kind", "version");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_defaultLocationId_fkey" FOREIGN KEY ("defaultLocationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_locations" ADD CONSTRAINT "employee_locations_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_locations" ADD CONSTRAINT "employee_locations_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
