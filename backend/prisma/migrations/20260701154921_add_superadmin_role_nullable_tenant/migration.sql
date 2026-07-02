-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SUPERADMIN';

-- DropIndex
DROP INDEX "configurations_key_key";

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "tenantId" DROP NOT NULL;
