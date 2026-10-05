-- Check-In: fichajes y acuses de textos legales. Solo aditivo. Ambas tablas
-- son evidencia inalterable (append-only) protegida por forbid_mutation()
-- (ver migracion immutability_guard): ni UPDATE ni DELETE salvo el escape
-- explicito chefchek.allow_evidence_purge.

-- CreateEnum
CREATE TYPE "PunchType" AS ENUM ('IN', 'OUT', 'BREAK_START', 'BREAK_END');

-- CreateEnum
CREATE TYPE "PunchSource" AS ENUM ('PERSONAL', 'KIOSK');

-- CreateEnum
CREATE TYPE "PunchGeofenceStatus" AS ENUM ('INSIDE', 'OUTSIDE', 'UNAVAILABLE', 'OFF');

-- CreateEnum
CREATE TYPE "PunchPinStatus" AS ENUM ('VERIFIED', 'NOT_REQUIRED', 'PENDING_REVIEW');

-- CreateTable
CREATE TABLE "time_punches" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "type" "PunchType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "deviceTime" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "PunchSource" NOT NULL,
    "recordedByUserId" TEXT NOT NULL,
    "locationId" TEXT,
    "locationName" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "accuracyM" DOUBLE PRECISION,
    "distanceM" DOUBLE PRECISION,
    "geofenceStatus" "PunchGeofenceStatus" NOT NULL,
    "pinStatus" "PunchPinStatus" NOT NULL,
    "wasOffline" BOOLEAN NOT NULL DEFAULT false,
    "deviceId" TEXT,
    "userAgent" TEXT,
    "seq" INTEGER NOT NULL,
    "prevHash" TEXT,
    "hash" TEXT NOT NULL,

    CONSTRAINT "time_punches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_in_legal_acks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "legalTextId" TEXT NOT NULL,
    "kind" "CheckInLegalTextKind" NOT NULL,
    "version" INTEGER NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "ackAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "check_in_legal_acks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "time_punches_tenantId_employeeId_occurredAt_idx" ON "time_punches"("tenantId", "employeeId", "occurredAt");

-- CreateIndex
CREATE INDEX "time_punches_tenantId_occurredAt_idx" ON "time_punches"("tenantId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "time_punches_tenantId_seq_key" ON "time_punches"("tenantId", "seq");

-- CreateIndex
CREATE INDEX "check_in_legal_acks_tenantId_employeeId_idx" ON "check_in_legal_acks"("tenantId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "check_in_legal_acks_legalTextId_employeeId_key" ON "check_in_legal_acks"("legalTextId", "employeeId");

-- Inalterabilidad
CREATE TRIGGER trg_forbid_mutation
  BEFORE UPDATE OR DELETE ON "time_punches"
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER trg_forbid_mutation
  BEFORE UPDATE OR DELETE ON "check_in_legal_acks"
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
