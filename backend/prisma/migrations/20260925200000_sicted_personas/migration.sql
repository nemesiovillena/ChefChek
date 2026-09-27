-- CreateTable
CREATE TABLE "sicted_job_profiles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mission" TEXT,
    "responsibilities" TEXT[],
    "tasks" TEXT[],
    "requirements" TEXT,
    "reportsTo" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sicted_job_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sicted_job_assignments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "since" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "until" TIMESTAMP(3),

    CONSTRAINT "sicted_job_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sicted_training_plans" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sicted_training_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sicted_training_actions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "plannedDate" TIMESTAMP(3) NOT NULL,
    "hours" DOUBLE PRECISION,
    "trainer" TEXT,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sicted_training_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sicted_training_attendances" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "attended" BOOLEAN NOT NULL,
    "certificate" JSONB,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sicted_training_attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sicted_protocols" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "body" TEXT,
    "knowledgeArticleId" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewDueAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sicted_protocols_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sicted_protocol_acks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "protocolVersion" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "ackedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sicted_protocol_acks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sicted_job_profiles_tenantId_idx" ON "sicted_job_profiles"("tenantId");

-- CreateIndex
CREATE INDEX "sicted_job_assignments_tenantId_idx" ON "sicted_job_assignments"("tenantId");

-- CreateIndex
CREATE INDEX "sicted_job_assignments_profileId_idx" ON "sicted_job_assignments"("profileId");

-- CreateIndex
CREATE INDEX "sicted_job_assignments_userId_idx" ON "sicted_job_assignments"("userId");

-- CreateIndex
CREATE INDEX "sicted_training_plans_tenantId_idx" ON "sicted_training_plans"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "sicted_training_plans_tenantId_year_key" ON "sicted_training_plans"("tenantId", "year");

-- CreateIndex
CREATE INDEX "sicted_training_actions_tenantId_idx" ON "sicted_training_actions"("tenantId");

-- CreateIndex
CREATE INDEX "sicted_training_actions_planId_idx" ON "sicted_training_actions"("planId");

-- CreateIndex
CREATE INDEX "sicted_training_attendances_tenantId_idx" ON "sicted_training_attendances"("tenantId");

-- CreateIndex
CREATE INDEX "sicted_training_attendances_userId_idx" ON "sicted_training_attendances"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "sicted_training_attendances_actionId_userId_key" ON "sicted_training_attendances"("actionId", "userId");

-- CreateIndex
CREATE INDEX "sicted_protocols_tenantId_idx" ON "sicted_protocols"("tenantId");

-- CreateIndex
CREATE INDEX "sicted_protocol_acks_tenantId_idx" ON "sicted_protocol_acks"("tenantId");

-- CreateIndex
CREATE INDEX "sicted_protocol_acks_userId_idx" ON "sicted_protocol_acks"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "sicted_protocol_acks_protocolId_protocolVersion_userId_key" ON "sicted_protocol_acks"("protocolId", "protocolVersion", "userId");

-- AddForeignKey
ALTER TABLE "sicted_job_assignments" ADD CONSTRAINT "sicted_job_assignments_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "sicted_job_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sicted_training_actions" ADD CONSTRAINT "sicted_training_actions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "sicted_training_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sicted_training_attendances" ADD CONSTRAINT "sicted_training_attendances_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "sicted_training_actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sicted_protocol_acks" ADD CONSTRAINT "sicted_protocol_acks_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "sicted_protocols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Inalterabilidad (fase 7 SICTED, personas — puestos/formación/protocolos):
--
-- sicted_job_profiles / sicted_job_assignments: SIN trigger — son datos
-- organizativos que se editan (ficha de puesto, reasignación), no evidencia.
--
-- sicted_training_attendances: append-only puro (forbid_mutation en
-- UPDATE/DELETE) -- una asistencia registrada es evidencia permanente.
--
-- sicted_protocol_acks: append-only puro (forbid_mutation en UPDATE/DELETE)
-- -- el acuse duplicado ya lo bloquea el índice único (protocolId,
-- protocolVersion, userId); el trigger impide reescribir uno existente.

CREATE TRIGGER trg_forbid_mutation
  BEFORE UPDATE OR DELETE ON "sicted_training_attendances"
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER trg_forbid_mutation
  BEFORE UPDATE OR DELETE ON "sicted_protocol_acks"
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
