-- Contador de platos en vivo con Cuiner (PostgreSQL del TPV).
ALTER TYPE "PortionMovementType" ADD VALUE 'ORDER';
ALTER TYPE "PortionMovementType" ADD VALUE 'CUINER_LOAD';

ALTER TABLE "cuiner_configs" ADD COLUMN "portionCursor" INTEGER;

ALTER TABLE "portion_counters" ADD COLUMN "cuinerAvailable" DOUBLE PRECISION,
ADD COLUMN "cuinerCheckedAt" TIMESTAMP(3),
ADD COLUMN "cuinerMismatchNotifiedAt" TIMESTAMP(3);

ALTER TABLE "portion_movements" ADD COLUMN "cuinerRegistroId" INTEGER;

CREATE TABLE "portion_cuiner_pushes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "counterId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "plato" TEXT,
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portion_cuiner_pushes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "portion_cuiner_pushes_tenantId_sentAt_idx" ON "portion_cuiner_pushes"("tenantId", "sentAt");
CREATE INDEX "portion_cuiner_pushes_counterId_idx" ON "portion_cuiner_pushes"("counterId");

ALTER TABLE "portion_cuiner_pushes" ADD CONSTRAINT "portion_cuiner_pushes_counterId_fkey" FOREIGN KEY ("counterId") REFERENCES "portion_counters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
