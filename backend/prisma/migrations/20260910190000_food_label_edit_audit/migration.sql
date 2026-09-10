-- AlterTable
ALTER TABLE "food_labels"
  ADD COLUMN "editedAt" TIMESTAMP(3),
  ADD COLUMN "editedByUserId" TEXT,
  ADD COLUMN "editedByName" TEXT,
  ADD COLUMN "editCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "editLog" JSONB;
