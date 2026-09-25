-- CreateTable
CREATE TABLE "checklist_assets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "externalCode" TEXT,
    "category" TEXT NOT NULL,
    "usedByModules" TEXT[],
    "location" TEXT,
    "provider" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_maintenance_plans" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "periodicityMonths" INTEGER NOT NULL,
    "nextDueAt" TIMESTAMP(3) NOT NULL,
    "lastDoneAt" TIMESTAMP(3),
    "externalProvider" BOOLEAN NOT NULL DEFAULT false,
    "responsible" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "dueSoonAlertedAt" TIMESTAMP(3),
    "overdueAlertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_maintenance_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_maintenance_records" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL,
    "performedByName" TEXT NOT NULL,
    "providerName" TEXT,
    "cost" DOUBLE PRECISION,
    "notes" TEXT,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "recordedByUserId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checklist_maintenance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_incidents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT,
    "usedByModules" TEXT[],
    "kind" TEXT NOT NULL,
    "partNumber" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detectedByName" TEXT NOT NULL,
    "reportedTo" TEXT,
    "faultType" TEXT,
    "technicianNotifiedAt" TIMESTAMP(3),
    "serviceStartedAt" TIMESTAMP(3),
    "serviceEndedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "processOrEquipment" TEXT,
    "deviationDescription" TEXT,
    "deviationCause" TEXT,
    "correctiveMeasure" TEXT,
    "responsibleName" TEXT,
    "deadline" TIMESTAMP(3),
    "resolution" TEXT,
    "affectedLot" TEXT,
    "affectedProductName" TEXT,
    "affectedQuantity" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "checklist_assets_tenantId_idx" ON "checklist_assets"("tenantId");

-- CreateIndex
CREATE INDEX "checklist_assets_tenantId_usedByModules_idx" ON "checklist_assets"("tenantId", "usedByModules");

-- CreateIndex
CREATE INDEX "checklist_maintenance_plans_tenantId_idx" ON "checklist_maintenance_plans"("tenantId");

-- CreateIndex
CREATE INDEX "checklist_maintenance_plans_tenantId_nextDueAt_idx" ON "checklist_maintenance_plans"("tenantId", "nextDueAt");

-- CreateIndex
CREATE INDEX "checklist_maintenance_records_tenantId_idx" ON "checklist_maintenance_records"("tenantId");

-- CreateIndex
CREATE INDEX "checklist_maintenance_records_tenantId_planId_idx" ON "checklist_maintenance_records"("tenantId", "planId");

-- CreateIndex
CREATE INDEX "checklist_incidents_tenantId_idx" ON "checklist_incidents"("tenantId");

-- CreateIndex
CREATE INDEX "checklist_incidents_tenantId_status_idx" ON "checklist_incidents"("tenantId", "status");

-- CreateIndex
CREATE INDEX "checklist_incidents_tenantId_kind_idx" ON "checklist_incidents"("tenantId", "kind");

-- AddForeignKey
ALTER TABLE "checklist_maintenance_plans" ADD CONSTRAINT "checklist_maintenance_plans_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "checklist_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_maintenance_records" ADD CONSTRAINT "checklist_maintenance_records_planId_fkey" FOREIGN KEY ("planId") REFERENCES "checklist_maintenance_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_maintenance_records" ADD CONSTRAINT "checklist_maintenance_records_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "checklist_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_incidents" ADD CONSTRAINT "checklist_incidents_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "checklist_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Inalterabilidad (fase 4 SICTED, motor de mantenimiento):
--
-- checklist_maintenance_records: append-only puro, reutiliza forbid_mutation()
-- de la migracion immutability_guard (fase 1) tal cual.
--
-- checklist_incidents: "fila que avanza por hitos" -- DELETE siempre
-- bloqueado (forbid_mutation() adjuntada solo a BEFORE DELETE: TG_OP='DELETE'
-- siempre cae en el RAISE), pero SI admite UPDATE porque el estado avanza
-- (OPEN->NOTIFIED->RESOLVED, notas, etc.). Lo que no puede pasar es que un
-- campo de fecha/hora de hito YA PUESTO se reescriba con otro valor --
-- forbid_milestone_rewrite() lo impide columna a columna (recibe los nombres
-- por TG_ARGV, generico para cualquier tabla futura con el mismo patron).
-- `deadline` se deja fuera a proposito: es una fecha objetivo planificable
-- (el PAC puede necesitar una prorroga legitima antes de resolverse), no un
-- evento historico como "se avisó al técnico"/"empezó el servicio".

CREATE OR REPLACE FUNCTION forbid_milestone_rewrite()
RETURNS trigger AS $$
DECLARE
  col text;
  old_val text;
  new_val text;
BEGIN
  IF current_setting('chefchek.allow_evidence_purge', true) = 'on' THEN
    RETURN NEW;
  END IF;

  FOREACH col IN ARRAY TG_ARGV LOOP
    EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', col, col)
      INTO old_val, new_val
      USING OLD, NEW;
    IF old_val IS NOT NULL AND old_val IS DISTINCT FROM new_val THEN
      RAISE EXCEPTION 'Tabla % columna % ya tiene valor (%): no se puede reescribir (fila id=%)',
        TG_TABLE_NAME, col, old_val, NEW.id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_forbid_mutation
  BEFORE UPDATE OR DELETE ON "checklist_maintenance_records"
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER trg_forbid_incident_delete
  BEFORE DELETE ON "checklist_incidents"
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER trg_forbid_incident_milestone_rewrite
  BEFORE UPDATE ON "checklist_incidents"
  FOR EACH ROW EXECUTE FUNCTION forbid_milestone_rewrite(
    'technicianNotifiedAt', 'serviceStartedAt', 'serviceEndedAt', 'resolvedAt'
  );
