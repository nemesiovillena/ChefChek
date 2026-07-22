import { BadRequestException } from "@nestjs/common";

// `image/jpg` is a non-standard but very common alias for JPEG sent by some
// browsers and Android image pickers. Accept it alongside `image/jpeg` so
// valid JPEGs are not rejected at the door. HEIC/HEIF are intentionally
// excluded: browsers cannot render them, so storing one would produce a
// broken avatar.
const ALLOWED_IMAGE_MIMETYPES = new Set<string>([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/**
 * Assert an uploaded file is a supported web image type, throwing
 * BadRequestException otherwise. Shared by the user-avatar and product-image
 * upload endpoints so the allowed-types policy lives in a single place.
 */
export function assertAllowedImageType(file: Express.Multer.File): void {
  if (!ALLOWED_IMAGE_MIMETYPES.has(file.mimetype)) {
    throw new BadRequestException(
      "Tipo de imagen no permitido. Use JPEG, PNG, WebP o GIF.",
    );
  }
}
