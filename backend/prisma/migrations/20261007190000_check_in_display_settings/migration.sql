-- AlterTable
ALTER TABLE "check_in_settings" ADD COLUMN "allowBreaks" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "showRecentPunches" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "showMonthPicker" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "showOwnAdjustments" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "showAddMissingDay" BOOLEAN NOT NULL DEFAULT true;
