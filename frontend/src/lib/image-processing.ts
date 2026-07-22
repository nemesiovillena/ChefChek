"use client";

const MAX_AVATAR_DIMENSION = 512;
const OUTPUT_MIME = "image/jpeg";
const OUTPUT_QUALITY = 0.85;

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar la imagen"));
    img.src = src;
  });
}

function scaleToFit(width: number, height: number, max: number) {
  if (width <= max && height <= max) return { width, height };
  const ratio = width >= height ? max / width : max / height;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

/**
 * Re-encode an image file as a resized JPEG before uploading it.
 *
 * Production avatar uploads were failing with a 400 because the backend's
 * mimetype allowlist rejected valid images that arrive as the non-standard
 * `image/jpg` JPEG alias, or as HEIC from iPhone/macOS Photos. Drawing the
 * file onto a canvas and exporting JPEG normalizes any decodable source
 * format into a clean `image/jpeg`, and shrinks phone photos so they stay
 * under the upload size limit.
 *
 * If the browser cannot decode the source (e.g. HEIC on Chrome/Firefox), the
 * original file is returned unchanged so the backend surfaces a clear type
 * error instead of the upload failing silently.
 */
export async function processImageForUpload(
  file: File,
  maxDimension: number = MAX_AVATAR_DIMENSION,
): Promise<File> {
  if (typeof document === "undefined") return file;
  try {
    const dataUrl = await readFileAsDataURL(file);
    const img = await loadImageElement(dataUrl);
    const { width, height } = scaleToFit(img.width, img.height, maxDimension);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, OUTPUT_MIME, OUTPUT_QUALITY),
    );
    if (!blob) return file;
    const baseName = (file.name || "avatar").replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}.jpg`, {
      type: OUTPUT_MIME,
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}
