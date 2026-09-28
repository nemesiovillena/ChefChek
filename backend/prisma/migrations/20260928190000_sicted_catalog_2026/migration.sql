-- AlterTable
ALTER TABLE "sicted_practices" ADD COLUMN     "axis" TEXT,
ADD COLUMN     "chapter" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "isEssential" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "moduleCode" TEXT,
ADD COLUMN     "moduleName" TEXT,
ADD COLUMN     "notApplicableWhen" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "ods" TEXT,
ADD COLUMN     "relatedCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "requiredDocs" TEXT,
ADD COLUMN     "requiresDocs" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "templates" TEXT,
ALTER COLUMN "bpSection" DROP NOT NULL,
ALTER COLUMN "bpSectionName" DROP NOT NULL;

-- AlterTable
ALTER TABLE "sicted_assessment_scores" ADD COLUMN     "result" TEXT;

-- CreateTable
CREATE TABLE "sicted_settings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "enabledComplementaryModules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sicted_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sicted_settings_tenantId_key" ON "sicted_settings"("tenantId");

