-- CreateTable
CREATE TABLE "sicted_practices" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "bpSection" INTEGER NOT NULL,
    "bpSectionName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "manualVersion" TEXT NOT NULL DEFAULT 'Restaurantes v4',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sicted_practices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sicted_assessments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sicted_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sicted_assessment_scores" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "score" INTEGER,
    "notApplicable" BOOLEAN NOT NULL DEFAULT false,
    "evidenceNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sicted_assessment_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sicted_practices_tenantId_idx" ON "sicted_practices"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "sicted_practices_tenantId_code_key" ON "sicted_practices"("tenantId", "code");

-- CreateIndex
CREATE INDEX "sicted_assessments_tenantId_idx" ON "sicted_assessments"("tenantId");

-- CreateIndex
CREATE INDEX "sicted_assessment_scores_tenantId_idx" ON "sicted_assessment_scores"("tenantId");

-- CreateIndex
CREATE INDEX "sicted_assessment_scores_assessmentId_idx" ON "sicted_assessment_scores"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "sicted_assessment_scores_assessmentId_practiceId_key" ON "sicted_assessment_scores"("assessmentId", "practiceId");

-- AddForeignKey
ALTER TABLE "sicted_assessment_scores" ADD CONSTRAINT "sicted_assessment_scores_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "sicted_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sicted_assessment_scores" ADD CONSTRAINT "sicted_assessment_scores_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "sicted_practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Inalterabilidad (fase 9 SICTED, sub-PR 1 — catálogo y autoevaluación):
--
-- sicted_practices: SIN trigger — catálogo editable/ampliable por el tenant
-- (requisito explícito del plan), no es evidencia.
--
-- sicted_assessments: closedAt solo null->valor (forbid_milestone_rewrite,
-- misma función genérica de fases 4/6/7/8) — una vez cerrado el ciclo no se
-- puede reabrir.
--
-- sicted_assessment_scores: NO es append-only puro — el manual exige poder
-- corregir una puntuación MIENTRAS la autoevaluación está en borrador (no
-- hay "corrección con motivo" como en el motor de checklist; es una
-- valoración, se edita hasta el cierre). El bloqueo real es "inmutable
-- SOLO cuando la autoevaluación padre está CLOSED" — ninguna de las
-- funciones genéricas existentes (forbid_mutation, forbid_milestone_rewrite)
-- cubre "depende del estado de otra tabla", así que esta fase añade una
-- función nueva. Cubre INSERT/UPDATE/DELETE: un ciclo cerrado no admite ni
-- puntuaciones nuevas ni cambios en las existentes.

CREATE OR REPLACE FUNCTION forbid_score_update_if_assessment_closed()
RETURNS trigger AS $$
DECLARE
  assessment_status text;
  target_assessment_id text;
  target_row_id text;
BEGIN
  IF current_setting('chefchek.allow_evidence_purge', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  target_assessment_id := COALESCE(NEW."assessmentId", OLD."assessmentId");
  target_row_id := COALESCE(NEW.id, OLD.id);

  SELECT status INTO assessment_status FROM "sicted_assessments" WHERE id = target_assessment_id;
  IF assessment_status = 'CLOSED' THEN
    RAISE EXCEPTION 'La autoevaluación % está cerrada: no se puede modificar la puntuación (fila id=%)',
      target_assessment_id, target_row_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_forbid_score_mutation_if_closed
  BEFORE INSERT OR UPDATE OR DELETE ON "sicted_assessment_scores"
  FOR EACH ROW EXECUTE FUNCTION forbid_score_update_if_assessment_closed();

CREATE TRIGGER trg_forbid_assessment_closedat_rewrite
  BEFORE UPDATE ON "sicted_assessments"
  FOR EACH ROW EXECUTE FUNCTION forbid_milestone_rewrite('closedAt');
