-- Cuenta de dispositivo compartido (ordenador de cocina): no firma registros con su nombre.
ALTER TABLE "users" ADD COLUMN "isSharedAccount" BOOLEAN NOT NULL DEFAULT false;
