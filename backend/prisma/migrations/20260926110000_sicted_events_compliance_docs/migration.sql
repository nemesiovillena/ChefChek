-- CreateTable
CREATE TABLE "sicted_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "attended" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "attachment" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sicted_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sicted_compliance_docs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "holderName" TEXT,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "attachment" JSONB,
    "dueSoonAlertedAt" TIMESTAMP(3),
    "expiredAlertedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sicted_compliance_docs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sicted_events_tenantId_idx" ON "sicted_events"("tenantId");

-- CreateIndex
CREATE INDEX "sicted_compliance_docs_tenantId_idx" ON "sicted_compliance_docs"("tenantId");

-- CreateIndex
CREATE INDEX "sicted_compliance_docs_tenantId_expiresAt_idx" ON "sicted_compliance_docs"("tenantId", "expiresAt");


-- Inalterabilidad (fase 9 SICTED, sub-PR 3 — eventos y documentos legales):
--
-- sicted_events: evidencia de participación (asistencia a grupos de mejora,
-- formación del destino, evaluación externa) — append-only puro, sin ningún
-- hito que corregir después (a diferencia de feedback/objetos perdidos, no
-- tiene un ciclo "recibido→respondido→cerrado"). Reutiliza `forbid_mutation`
-- (fases 1+).
--
-- sicted_compliance_docs: SIN trigger — documento vivo (se corrige, se
-- renueva subiendo un nuevo `expiresAt`), no evidencia de un evento puntual.
-- Mismo criterio que `sicted_practices`/`sicted_objectives`.

CREATE TRIGGER trg_forbid_event_mutation
  BEFORE UPDATE OR DELETE ON "sicted_events"
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
