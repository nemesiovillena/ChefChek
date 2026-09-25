-- CreateTable
CREATE TABLE "sicted_improvement_actions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" INTEGER NOT NULL,
    "origin" TEXT NOT NULL,
    "sourceRef" TEXT,
    "title" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT,
    "responsibleName" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "evidenceNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sicted_improvement_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sicted_objectives" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "indicator" TEXT,
    "target" TEXT,
    "currentValue" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sicted_objectives_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sicted_improvement_actions_tenantId_idx" ON "sicted_improvement_actions"("tenantId");

-- CreateIndex
CREATE INDEX "sicted_improvement_actions_tenantId_status_idx" ON "sicted_improvement_actions"("tenantId", "status");

-- CreateIndex
CREATE INDEX "sicted_objectives_tenantId_idx" ON "sicted_objectives"("tenantId");

-- CreateIndex
CREATE INDEX "sicted_objectives_tenantId_year_idx" ON "sicted_objectives"("tenantId", "year");


-- Inalterabilidad (fase 9 SICTED, sub-PR 2 — plan de mejora y objetivos):
--
-- sicted_improvement_actions: entidad editable (como las fichas de puesto de
-- fase 7), NO append-only puro — se corrige mientras se trabaja la acción.
-- Solo `closedAt` ("fecha de implantación") es hito protegido: una vez
-- registrada la fecha real de implantación no se puede reescribir. Reutiliza
-- la función genérica `forbid_milestone_rewrite` (fases 4/6/7/8/9).
--
-- sicted_objectives: sin trigger — objetivo vivo, se actualiza `currentValue`
-- y `status` durante todo el año; no es evidencia de un evento puntual.

CREATE TRIGGER trg_forbid_improvement_action_closedat_rewrite
  BEFORE UPDATE ON "sicted_improvement_actions"
  FOR EACH ROW EXECUTE FUNCTION forbid_milestone_rewrite('closedAt');
