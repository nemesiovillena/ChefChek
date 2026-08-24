"use client";

const MAX_AVATAR_DIMENSION = 512;
const OUTPUT_MIME = "image/jpeg";
const OUTPUT_QUALITY = 0.85;

function readFileAsDataURL(file: Blob): Promise<string> {
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

function isHeic(file: File): boolean {
  return /^image\/hei[cf]$/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

/**
 * Convert an HEIC/HEIF photo (iPhone/macOS default) to JPEG. Chrome and
 * Firefox can't decode HEIC, so the canvas path below would fail and leave
 * the avatar rejected by the backend. `heic2any` ships its own WASM decoder
 * and is imported lazily so it is only downloaded when a user actually picks
 * an HEIC file. Returns null if the input isn't HEIC or decoding fails.
 */
async function convertHeicToJpeg(file: File): Promise<File | null> {
  if (!isHeic(file)) return null;
  try {
    const convert = (await import("heic2any")).default;
    const result = await convert({
      blob: file,
      toType: "image/jpeg",
      quality: 0.9,
    });
    const blob = Array.isArray(result) ? result[0] : result;
    if (!blob) return null;
    const baseName = (file.name || "avatar").replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}.jpg`, { type: OUTPUT_MIME });
  } catch {
    return null;
  }
}

/**
 * Re-encode an image file as a resized JPEG before uploading it.
 *
 * Production avatar uploads were failing with a 400 because the backend's
 * mimetype allowlist rejected valid images that arrive as the non-standard
 * `image/jpg` JPEG alias, or as HEIC from iPhone/macOS Photos. HEIC is first
 * converted to JPEG via `heic2any`; drawing the file onto a canvas and
 * exporting JPEG then normalizes any decodable source format into a clean
 * `image/jpeg` and shrinks phone photos so they stay under the upload size
 * limit.
 *
 * If the browser cannot decode the source, the original file is returned so
 * the backend surfaces a clear type error instead of the upload failing
 * silently.
 */
export async function processImageForUpload(
  file: File,
  maxDimension: number = MAX_AVATAR_DIMENSION,
): Promise<File> {
  if (typeof document === "undefined") return file;
  try {
    const heicConverted = await convertHeicToJpeg(file);
    const source = heicConverted ?? file;

    const dataUrl = await readFileAsDataURL(source);
    const img = await loadImageElement(dataUrl);
    const { width, height } = scaleToFit(img.width, img.height, maxDimension);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return source;
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, OUTPUT_MIME, OUTPUT_QUALITY),
    );
    if (!blob) return source;
    const baseName = (source.name || "avatar").replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}.jpg`, {
      type: OUTPUT_MIME,
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}
