-- CreateEnum
CREATE TYPE "BackupScope" AS ENUM ('TENANT', 'GLOBAL');

-- CreateEnum
CREATE TYPE "BackupStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "BackupKind" AS ENUM ('EXPORT', 'RESTORE');

-- CreateEnum
CREATE TYPE "BackupType" AS ENUM ('MANUAL', 'AUTO_PRE_RESTORE', 'AUTO_SCHEDULED');

-- CreateTable
CREATE TABLE "backups" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "scope" "BackupScope" NOT NULL DEFAULT 'TENANT',
    "status" "BackupStatus" NOT NULL DEFAULT 'PENDING',
    "kind" "BackupKind" NOT NULL,
    "type" "BackupType" NOT NULL DEFAULT 'MANUAL',
    "format" TEXT NOT NULL DEFAULT 'json',
    "filename" TEXT,
    "fileSizeBytes" BIGINT,
    "rowCount" INTEGER,
    "checksum" TEXT,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "sourceBackupId" TEXT,
    "notes" TEXT,
    "errorMessage" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "backups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "backups_tenantId_kind_createdAt_idx" ON "backups"("tenantId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "backups_scope_createdAt_idx" ON "backups"("scope", "createdAt");
