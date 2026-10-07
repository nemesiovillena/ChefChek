/**
 * Reduce una foto en el navegador antes de subirla.
 *
 * Las fotos de móvil llegan a 24 MP y el servidor solo usa 1800 px de lado
 * mayor: subirlas enteras alarga la subida y obliga al microservicio OCR a
 * descodificar la imagen completa (~10 s por foto en producción) para
 * descartar casi todos los píxeles a continuación.
 *
 * Devuelve el archivo original si no es una imagen, si ya es pequeña o si el
 * navegador no sabe abrirla (p. ej. HEIC fuera de Safari): el servidor sigue
 * sabiendo reducirla por su cuenta.
 */

/** Mismo límite que MAX_IMAGE_DIMENSION en el microservicio OCR. */
const MAX_DIMENSION = 1800;
const JPEG_QUALITY = 0.9;

export async function downscaleImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  try {
    // 'from-image' aplica la rotación EXIF a los píxeles: el JPEG resultante
    // no lleva EXIF y, sin esto, las fotos en vertical saldrían tumbadas.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    try {
      const longestSide = Math.max(bitmap.width, bitmap.height);
      if (longestSide <= MAX_DIMENSION) return file;

      const scale = MAX_DIMENSION / longestSide;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const context = canvas.getContext('2d');
      if (!context) return file;
      context.imageSmoothingQuality = 'high';
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
      );
      if (!blob || blob.size >= file.size) return file;

      const baseName = file.name.replace(/\.[^.]+$/, '');
      return new File([blob], `${baseName}.jpg`, {
        type: 'image/jpeg',
        lastModified: file.lastModified,
      });
    } finally {
      bitmap.close();
    }
  } catch {
    return file;
  }
}
