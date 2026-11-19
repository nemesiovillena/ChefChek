-- CreateEnum
CREATE TYPE "AlbaranReturnStatus" AS ENUM ('PENDIENTE', 'APLICADA', 'DESCARTADA');

-- CreateEnum
CREATE TYPE "AlbaranReturnSettlement" AS ENUM ('IN_ALBARAN', 'CREDIT_NOTE');

-- CreateTable
CREATE TABLE "albaran_returns" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "albaranId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "reason" TEXT NOT NULL,
    "reportedByName" TEXT NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "AlbaranReturnStatus" NOT NULL DEFAULT 'PENDIENTE',
    "settlement" "AlbaranReturnSettlement",
    "discardNote" TEXT,
    "lineId" TEXT,
    "appliedLineId" TEXT,
    "creditNoteLineId" TEXT,
    "creditNoteSettledAt" TIMESTAMP(3),
    "sictedIncidentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "albaran_returns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "albaran_returns_appliedLineId_key" ON "albaran_returns"("appliedLineId");

-- CreateIndex
CREATE UNIQUE INDEX "albaran_returns_creditNoteLineId_key" ON "albaran_returns"("creditNoteLineId");

-- CreateIndex
CREATE INDEX "albaran_returns_tenantId_idx" ON "albaran_returns"("tenantId");

-- CreateIndex
CREATE INDEX "albaran_returns_albaranId_idx" ON "albaran_returns"("albaranId");

-- CreateIndex
CREATE INDEX "albaran_returns_tenantId_status_idx" ON "albaran_returns"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "albaran_returns" ADD CONSTRAINT "albaran_returns_albaranId_fkey" FOREIGN KEY ("albaranId") REFERENCES "albaranes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "albaran_returns" ADD CONSTRAINT "albaran_returns_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "albaran_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "albaran_returns" ADD CONSTRAINT "albaran_returns_appliedLineId_fkey" FOREIGN KEY ("appliedLineId") REFERENCES "albaran_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "albaran_returns" ADD CONSTRAINT "albaran_returns_creditNoteLineId_fkey" FOREIGN KEY ("creditNoteLineId") REFERENCES "albaran_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
