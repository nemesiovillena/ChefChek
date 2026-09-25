-- CreateTable
CREATE TABLE "checklist_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "externalCode" TEXT,
    "usedByModules" TEXT[],
    "kind" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "weekday" INTEGER,
    "dayOfMonth" INTEGER,
    "responsiblePosition" TEXT,
    "requiresSupervisor" BOOLEAN NOT NULL DEFAULT false,
    "practiceRef" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_template_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "itemFrequency" TEXT,
    "procedure" TEXT,
    "products" TEXT[],
    "dosage" TEXT,
    "epi" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "expectedRangeMin" DOUBLE PRECISION,
    "expectedRangeMax" DOUBLE PRECISION,

    CONSTRAINT "checklist_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_runs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "snapshot" JSONB NOT NULL,
    "closedAt" TIMESTAMP(3),
    "supervisedAt" TIMESTAMP(3),
    "supervisedByUserId" TEXT,
    "supervisorName" TEXT,
    "supervisorNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checklist_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_entries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "outcome" TEXT,
    "reason" TEXT,
    "observation" TEXT,
    "value" DOUBLE PRECISION,
    "withinRange" BOOLEAN,
    "correctiveAction" TEXT,
    "note" TEXT,
    "correctsEntryId" TEXT,
    "performedByUserId" TEXT,
    "performedByName" TEXT NOT NULL,
    "sessionUserId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checklist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "checklist_templates_tenantId_idx" ON "checklist_templates"("tenantId");

-- CreateIndex
CREATE INDEX "checklist_templates_tenantId_archivedAt_idx" ON "checklist_templates"("tenantId", "archivedAt");

-- CreateIndex
CREATE INDEX "checklist_template_items_tenantId_idx" ON "checklist_template_items"("tenantId");

-- CreateIndex
CREATE INDEX "checklist_template_items_templateId_idx" ON "checklist_template_items"("templateId");

-- CreateIndex
CREATE INDEX "checklist_runs_tenantId_idx" ON "checklist_runs"("tenantId");

-- CreateIndex
CREATE INDEX "checklist_runs_tenantId_periodStart_idx" ON "checklist_runs"("tenantId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "checklist_runs_templateId_periodKey_key" ON "checklist_runs"("templateId", "periodKey");

-- CreateIndex
CREATE INDEX "checklist_entries_tenantId_idx" ON "checklist_entries"("tenantId");

-- CreateIndex
CREATE INDEX "checklist_entries_runId_itemId_idx" ON "checklist_entries"("runId", "itemId");

-- AddForeignKey
ALTER TABLE "checklist_template_items" ADD CONSTRAINT "checklist_template_items_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "checklist_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_runs" ADD CONSTRAINT "checklist_runs_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "checklist_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_entries" ADD CONSTRAINT "checklist_entries_runId_fkey" FOREIGN KEY ("runId") REFERENCES "checklist_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_entries" ADD CONSTRAINT "checklist_entries_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "checklist_template_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_entries" ADD CONSTRAINT "checklist_entries_correctsEntryId_fkey" FOREIGN KEY ("correctsEntryId") REFERENCES "checklist_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Guarda de inalterabilidad (funciones creadas en 20260924203049_immutability_guard):
-- checklist_entries es evidencia pura, append-only para siempre.
CREATE TRIGGER trg_checklist_entries_forbid_mutation
  BEFORE UPDATE OR DELETE ON "checklist_entries"
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- checklist_runs es editable (status, snapshot al crear, etc.) hasta que se
-- supervisa (mode=INSPECTION); una vez con supervisedAt puesto, se congela.
CREATE TRIGGER trg_checklist_runs_forbid_mutation_after_seal
  BEFORE UPDATE OR DELETE ON "checklist_runs"
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation_after_seal();
