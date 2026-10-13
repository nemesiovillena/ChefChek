/**
 * Captura de recetas: una receta externa (URL, texto o foto/PDF) que la IA
 * convierte a nuestro formato y queda en revisión hasta pasarla a Recetas.
 */

/** `DESCARTADA` existe en el servidor pero nunca llega al frontend. */
export type RecipeCaptureStatus = 'PROCESANDO' | 'PENDIENTE' | 'ERROR' | 'PASANDO' | 'PASADA';
export type RecipeCaptureSource = 'URL' | 'TEXTO' | 'ARCHIVO';

export interface RecipeCaptureListItem {
  id: string;
  source: RecipeCaptureSource;
  sourceUrl: string | null;
  sourceFileName: string | null;
  status: RecipeCaptureStatus;
  errorMessage: string | null;
  name: string | null;
  /** Receta creada al pasarla; null en una PASADA significa que la receta se eliminó. */
  recipeId: string | null;
  /** Cuándo empezó el paso a Recetas (solo en PASANDO). */
  claimedAt: string | null;
  /** Foto del plato capturada (ya subida a nuestro almacenamiento), si la hay. */
  imageUrl: string | null;
  /** Si se puede reintentar desde su fuente (falso en capturas de archivo antiguas, sin el archivo guardado). */
  canRetry: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeCaptureIngredient {
  id: string;
  /** Línea tal como venía en la fuente. */
  rawText: string;
  name: string;
  quantity: number | null;
  /** g | kg | ml | l | ud */
  unit: string | null;
  note: string | null;
  matchedProductId: string | null;
  /** 0..1 si el artículo lo sugirió el sistema; null si lo eligió el usuario. */
  matchConfidence: number | null;
  matchedProduct: { id: string; name: string; deletedAt: string | null } | null;
}

export interface RecipeCapture extends RecipeCaptureListItem {
  /** Texto pegado por el usuario (solo capturas de origen TEXTO). */
  sourceText: string | null;
  description: string | null;
  /** JSON `{"steps":[...]}`, igual que en Recetas. */
  elaboration: string | null;
  portions: number | null;
  preparationTimeMinutes: number | null;
  cookingTimeMinutes: number | null;
  ingredients: RecipeCaptureIngredient[];
}

export interface PromotionResult {
  recipeId: string;
  /** Ingredientes que pasaron como líneas / a notas. null si la receta ya existía. */
  lines: number | null;
  toNotes: number | null;
}

/** Límites que también impone el servidor. */
export const MAX_CAPTURE_TEXT_LENGTH = 20_000;
export const MIN_CAPTURE_TEXT_LENGTH = 20;
export const MAX_CAPTURE_FILE_BYTES = 5 * 1024 * 1024;
export const CAPTURE_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
