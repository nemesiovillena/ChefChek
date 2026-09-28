-- AlterTable
ALTER TABLE "sicted_settings" ADD COLUMN     "cyclePhase" TEXT,
ADD COLUMN     "nextCommitteeDate" TIMESTAMP(3),
ADD COLUMN     "phaseStartedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "sicted_improvement_actions" ADD COLUMN     "attachment" JSONB;

