-- CreateTable
CREATE TABLE "sicted_supplier_compliance_profiles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "suppliedCategories" TEXT[],
    "serviceUnits" TEXT[],
    "hasSafetyDataSheets" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "hasIndustrialRegistry" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "hasTechnicalSheets" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "qualityCertification" TEXT,
    "internalRulesGivenAt" TIMESTAMP(3),
    "firstContactAt" TIMESTAMP(3),
    "updatedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sicted_supplier_compliance_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sicted_supplier_incidents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "albaranId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transportOk" BOOLEAN,
    "productTemperature" DOUBLE PRECISION,
    "rejectionCause" TEXT,
    "description" TEXT NOT NULL,
    "reportedByName" TEXT NOT NULL,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sicted_supplier_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sicted_inventory_snapshots" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performedByName" TEXT NOT NULL,
    "scope" TEXT,
    "itemCount" INTEGER NOT NULL,
    "belowMinimumCount" INTEGER NOT NULL,
    "aboveMaximumCount" INTEGER NOT NULL,
    "snapshotData" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sicted_inventory_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sicted_supplier_compliance_profiles_tenantId_idx" ON "sicted_supplier_compliance_profiles"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "sicted_supplier_compliance_profiles_tenantId_supplierId_key" ON "sicted_supplier_compliance_profiles"("tenantId", "supplierId");

-- CreateIndex
CREATE INDEX "sicted_supplier_incidents_tenantId_idx" ON "sicted_supplier_incidents"("tenantId");

-- CreateIndex
CREATE INDEX "sicted_supplier_incidents_tenantId_supplierId_idx" ON "sicted_supplier_incidents"("tenantId", "supplierId");

-- CreateIndex
CREATE INDEX "sicted_inventory_snapshots_tenantId_idx" ON "sicted_inventory_snapshots"("tenantId");

-- Inalterabilidad (fase 6 SICTED, proveedores y aprovisionamiento):
--
-- sicted_supplier_compliance_profiles: NO lleva trigger — es un perfil que
-- se actualiza (upsert), no evidencia append-only, a diferencia del resto
-- de este modulo.
--
-- sicted_supplier_incidents: DELETE siempre bloqueado (forbid_mutation);
-- resolution/resolvedAt solo null->valor (forbid_milestone_rewrite, misma
-- funcion generica de la migracion checklist_maintenance de fase 4).
--
-- sicted_inventory_snapshots: append-only puro (forbid_mutation en
-- UPDATE/DELETE) -- un inventario generado es evidencia permanente.

CREATE TRIGGER trg_forbid_supplier_incident_delete
  BEFORE DELETE ON "sicted_supplier_incidents"
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER trg_forbid_supplier_incident_resolution_rewrite
  BEFORE UPDATE ON "sicted_supplier_incidents"
  FOR EACH ROW EXECUTE FUNCTION forbid_milestone_rewrite('resolution', 'resolvedAt');

CREATE TRIGGER trg_forbid_mutation
  BEFORE UPDATE OR DELETE ON "sicted_inventory_snapshots"
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

