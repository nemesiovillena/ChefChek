/**
 * Upload API utility — bypasses Next.js rewrite proxy for multipart uploads.
 *
 * The Next.js dev server proxy can corrupt multipart/form-data bodies on
 * browser fetch requests, causing 500 errors. This utility sends uploads
 * directly to the backend instead.
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

/** Full URL for the albaran OCR upload endpoint (albaran module with persistence) */
export const ALBARAN_UPLOAD_URL = `${API_BASE_URL}/v1/albaranes/from-upload`;

/** Generic upload URL builder — appends path to direct backend base */
export function uploadUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}
