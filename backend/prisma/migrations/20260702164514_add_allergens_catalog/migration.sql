-- CreateTable
CREATE TABLE "allergens" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nameEu1169" TEXT,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "severity" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "allergens_pkey" PRIMARY KEY ("id")
);
