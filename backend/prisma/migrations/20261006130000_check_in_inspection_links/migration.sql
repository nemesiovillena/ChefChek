-- Check-In: enlaces de solo lectura para la Inspeccion de Trabajo. Solo aditivo.

-- CreateTable
CREATE TABLE "check_in_inspection_links" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "label" TEXT,
    "fromYear" INTEGER NOT NULL,
    "fromMonth" INTEGER NOT NULL,
    "toYear" INTEGER NOT NULL,
    "toMonth" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessAt" TIMESTAMP(3),

    CONSTRAINT "check_in_inspection_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "check_in_inspection_links_tokenHash_key" ON "check_in_inspection_links"("tokenHash");

-- CreateIndex
CREATE INDEX "check_in_inspection_links_tenantId_idx" ON "check_in_inspection_links"("tenantId");
