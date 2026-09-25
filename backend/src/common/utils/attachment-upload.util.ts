import { BadRequestException } from "@nestjs/common";

/**
 * Allowlist explícita para adjuntos de mantenimiento (certificados de
 * revisión, facturas de proveedor externo): PDF y fotos, incluido HEIC — a
 * diferencia de `image-upload.util.ts` (avatares/artículos, que rechaza HEIC
 * a propósito porque el frontend ya lo convierte a JPEG antes de subir para
 * poder renderizarlo en <img>), un certificado no se renderiza inline: se
 * descarga, así que HEIC (fotos de iPhone de una factura en papel) es
 * legítimo. Ver memoria del proyecto: ya hubo un 400 en prod por un
 * allowlist que rechazaba `image/jpg` (alias) y HEIC.
 */
const ALLOWED_ATTACHMENT_MIMETYPES = new Set<string>([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/heic",
  "image/heif",
]);

export function assertAllowedAttachmentType(file: Express.Multer.File): void {
  if (!ALLOWED_ATTACHMENT_MIMETYPES.has(file.mimetype)) {
    throw new BadRequestException(
      "Tipo de adjunto no permitido. Use PDF, JPEG, PNG o HEIC.",
    );
  }
}
