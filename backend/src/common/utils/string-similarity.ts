/**
 * String similarity utilities using Levenshtein distance algorithm.
 * Used for fuzzy matching in product recognition and supplier matching.
 */

/**
 * Calculates the Levenshtein distance between two strings.
 * The Levenshtein distance is the minimum number of single-character edits
 * (insertions, deletions, or substitutions) required to change one string into the other.
 *
 * @param str1 - First string to compare
 * @param str2 - Second string to compare
 * @returns The Levenshtein distance (number of edits needed)
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  // Initialize first column
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  // Initialize first row
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1, // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Calculates similarity score between two strings (0 to 1).
 * Uses Levenshtein distance normalized by the length of the longer string.
 *
 * @param str1 - First string to compare
 * @param str2 - Second string to compare
 * @returns Similarity score between 0 (completely different) and 1 (identical)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) {
    return 1.0;
  }

  const distance = levenshteinDistance(longer, shorter);
  return 1 - distance / longer.length;
}

/**
 * Normalizes CIF/NIF for comparison by removing formatting characters.
 * Removes hyphens, spaces, and converts to uppercase.
 *
 * @param cifNif - CIF/NIF string to normalize
 * @returns Normalized CIF/NIF
 */
export function normalizeCifNif(cifNif: string): string {
  return cifNif.toUpperCase().replace(/[-\s]/g, "").trim();
}

/**
 * Normalizes a product description for alias lookup: lowercase, sin acentos,
 * puntuación colapsada a espacios. Dos descripciones que un mismo proveedor
 * escribe con distinta capitalización/puntuación producen la misma clave.
 *
 * @param text - Description text to normalize
 * @returns Normalized description
 */
export function normalizeProductDescription(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
