/**
 * Condiciones de conservación de un alimento. Fuente única compartida por
 * Recetas, Artículos y el módulo de Etiquetado (columnas `storageCondition`).
 */
export const STORAGE_CONDITIONS = [
  "REFRIGERATED",
  "FROZEN",
  "AMBIENT",
] as const;

export type StorageCondition = (typeof STORAGE_CONDITIONS)[number];
