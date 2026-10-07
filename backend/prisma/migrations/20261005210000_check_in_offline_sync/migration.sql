-- Check-In: fichaje sin conexion. Solo aditivo.
--  * time_punches: marca de "a revisar" fijada al crear el fichaje.
--  * check_in_kiosk_keys: par de claves por tenant para cifrar el PIN de los
--    fichajes sin conexion del kiosco.

-- AlterTable
ALTER TABLE "time_punches" ADD COLUMN     "needsReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reviewReason" TEXT;

-- CreateTable
CREATE TABLE "check_in_kiosk_keys" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "publicKeySpki" TEXT NOT NULL,
    "privateKeyPkcs8" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "check_in_kiosk_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "check_in_kiosk_keys_tenantId_key" ON "check_in_kiosk_keys"("tenantId");
