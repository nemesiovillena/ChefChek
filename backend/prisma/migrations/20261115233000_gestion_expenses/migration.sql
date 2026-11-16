-- Gestión: gastos generales por mes para la cuenta de explotación (tabla nueva, no toca datos existentes).
CREATE TABLE "gestion_expenses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "category" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "gestion_expenses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "gestion_expenses_tenantId_month_idx" ON "gestion_expenses"("tenantId", "month");
