-- CreateTable
CREATE TABLE "label_print_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "foodLabelId" TEXT,
    "format" TEXT,
    "copies" INTEGER,
    "outcome" TEXT NOT NULL,
    "errorMessage" TEXT,
    "calibrated" BOOLEAN NOT NULL DEFAULT false,
    "durationMs" INTEGER,
    "deviceUid" TEXT,
    "steps" JSONB NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "label_print_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "label_print_logs_tenantId_createdAt_idx" ON "label_print_logs"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "label_print_logs" ADD CONSTRAINT "label_print_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
