-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "addressCity" TEXT,
ADD COLUMN     "addressPostalCode" TEXT,
ADD COLUMN     "addressStreet" TEXT,
ADD COLUMN     "cifNif" TEXT,
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "contactPosition" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3);
