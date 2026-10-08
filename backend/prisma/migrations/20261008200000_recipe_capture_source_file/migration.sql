-- Archivo original de la captura (foto/PDF), para poder reintentar el
-- procesamiento si la IA falla. Se vacía cuando la captura se procesa bien.
ALTER TABLE "recipe_captures" ADD COLUMN "sourceFile" BYTEA;
ALTER TABLE "recipe_captures" ADD COLUMN "sourceFileMimeType" TEXT;
