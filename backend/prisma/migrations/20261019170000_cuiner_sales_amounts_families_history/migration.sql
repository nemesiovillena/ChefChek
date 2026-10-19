-- AlterEnum
ALTER TYPE "CuinerSaleStatus" ADD VALUE 'HISTORICO';

-- AlterTable
ALTER TABLE "cuiner_configs" ADD COLUMN     "historyCursor" INTEGER,
ADD COLUMN     "historyDone" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "cuiner_dishes" ADD COLUMN     "familia" TEXT;

-- AlterTable
ALTER TABLE "cuiner_sale_lines" ADD COLUMN     "base" DOUBLE PRECISION,
ADD COLUMN     "impuesto" DOUBLE PRECISION,
ADD COLUMN     "invitacion" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "cuiner_sale_lines_tenantId_fecha_idx" ON "cuiner_sale_lines"("tenantId", "fecha");
