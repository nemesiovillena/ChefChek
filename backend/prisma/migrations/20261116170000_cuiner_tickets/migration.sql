-- Cabeceras de ticket y cobros de Cuiner para Gestión (tablas nuevas + un
-- cursor nuevo en cuiner_configs; no toca datos existentes).
ALTER TABLE "cuiner_configs" ADD COLUMN "ticketCursor" INTEGER;

CREATE TABLE "cuiner_tickets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "idVentasCab" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "mesa" TEXT,
    "comensales" INTEGER,
    "turno" TEXT,
    "openedAt" TEXT,
    "closedAt" TEXT,
    "camarero" TEXT,
    "total" DOUBLE PRECISION,
    "invitacion" BOOLEAN NOT NULL DEFAULT false,
    "consumoPersonal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cuiner_tickets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cuiner_tickets_tenantId_idVentasCab_key" ON "cuiner_tickets"("tenantId", "idVentasCab");
CREATE INDEX "cuiner_tickets_tenantId_fecha_idx" ON "cuiner_tickets"("tenantId", "fecha");

CREATE TABLE "cuiner_ticket_payments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "idVentasCab" INTEGER NOT NULL,
    "linea" INTEGER NOT NULL,
    "formaPago" TEXT NOT NULL,
    "importe" DOUBLE PRECISION NOT NULL,
    "anulada" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "cuiner_ticket_payments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cuiner_ticket_payments_tenantId_idVentasCab_linea_key" ON "cuiner_ticket_payments"("tenantId", "idVentasCab", "linea");
CREATE INDEX "cuiner_ticket_payments_tenantId_idVentasCab_idx" ON "cuiner_ticket_payments"("tenantId", "idVentasCab");

CREATE TABLE "cuiner_waiters" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "cuiner_waiters_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cuiner_waiters_tenantId_code_key" ON "cuiner_waiters"("tenantId", "code");
