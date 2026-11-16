-- Gestión: festivos y fechas importantes por local (tabla nueva, no toca datos existentes).
CREATE TABLE "gestion_calendar_dates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "gestion_calendar_dates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gestion_calendar_dates_tenantId_date_name_key" ON "gestion_calendar_dates"("tenantId", "date", "name");
CREATE INDEX "gestion_calendar_dates_tenantId_date_idx" ON "gestion_calendar_dates"("tenantId", "date");
