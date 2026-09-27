-- CreateTable
CREATE TABLE "sicted_feedback" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedByName" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "customerContact" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "response" TEXT,
    "respondedAt" TIMESTAMP(3),
    "respondedByName" TEXT,
    "closedAt" TIMESTAMP(3),
    "improvementActionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sicted_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sicted_satisfaction_samples" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sampledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "comment" TEXT,
    "recordedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sicted_satisfaction_samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sicted_lost_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "foundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itemName" TEXT NOT NULL,
    "description" TEXT,
    "foundLocation" TEXT,
    "foundByName" TEXT NOT NULL,
    "returnedAt" TIMESTAMP(3),
    "returnedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sicted_lost_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sicted_feedback_tenantId_idx" ON "sicted_feedback"("tenantId");

-- CreateIndex
CREATE INDEX "sicted_feedback_tenantId_status_idx" ON "sicted_feedback"("tenantId", "status");

-- CreateIndex
CREATE INDEX "sicted_satisfaction_samples_tenantId_idx" ON "sicted_satisfaction_samples"("tenantId");

-- CreateIndex
CREATE INDEX "sicted_satisfaction_samples_tenantId_sampledAt_idx" ON "sicted_satisfaction_samples"("tenantId", "sampledAt");

-- CreateIndex
CREATE INDEX "sicted_lost_items_tenantId_idx" ON "sicted_lost_items"("tenantId");

-- Inalterabilidad (fase 8 SICTED, cliente y sostenibilidad):
--
-- sicted_feedback: DELETE bloqueado (forbid_mutation); respondedAt/closedAt
-- solo null->valor (forbid_milestone_rewrite, misma función genérica de
-- fase 4/6) — el resto de campos (status, response, respondedByName,
-- improvementActionId) sí se pueden actualizar libremente al avanzar de
-- hito, por eso NO lleva forbid_mutation en UPDATE, solo en DELETE.
--
-- sicted_satisfaction_samples: append-only puro (forbid_mutation en
-- UPDATE/DELETE) — una muestra de satisfacción es evidencia permanente.
--
-- sicted_lost_items: DELETE bloqueado (forbid_mutation); returnedAt solo
-- null->valor (forbid_milestone_rewrite) — returnedTo se escribe en el
-- mismo UPDATE que returnedAt, por eso también está en la lista de columnas
-- protegidas (ambas pasan de null a valor juntas, nunca por separado).

CREATE TRIGGER trg_forbid_feedback_delete
  BEFORE DELETE ON "sicted_feedback"
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER trg_forbid_feedback_milestone_rewrite
  BEFORE UPDATE ON "sicted_feedback"
  FOR EACH ROW EXECUTE FUNCTION forbid_milestone_rewrite('respondedAt', 'closedAt');

CREATE TRIGGER trg_forbid_mutation
  BEFORE UPDATE OR DELETE ON "sicted_satisfaction_samples"
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER trg_forbid_lost_item_delete
  BEFORE DELETE ON "sicted_lost_items"
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER trg_forbid_lost_item_milestone_rewrite
  BEFORE UPDATE ON "sicted_lost_items"
  FOR EACH ROW EXECUTE FUNCTION forbid_milestone_rewrite('returnedAt', 'returnedTo');
