import { randomUUID } from "node:crypto";
import { extname } from "node:path";

/**
 * Nombre de fichero para un archivo subido: UUID aleatorio + la extensión
 * original (saneada). Los ficheros de `/uploads` se sirven de forma estática,
 * así que el nombre no debe ser adivinable (antes era `${Date.now()}-nombre`,
 * deducible por marca de tiempo). El tenant que sube el archivo recibe la URL;
 * nadie más debería poder construirla.
 */
export function generateUploadFilename(originalName: string): string {
  const ext = extname(originalName || "")
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, "")
    .slice(0, 12);
  return `${randomUUID()}${ext}`;
}
