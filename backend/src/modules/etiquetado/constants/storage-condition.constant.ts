/**
 * Re-exporta la constante compartida de condiciones de conservación y añade
 * los tipos de etiqueta, que sí son propios de este módulo.
 */
import {
  STORAGE_CONDITIONS,
  StorageCondition,
} from "../../../common/constants/storage-condition.constant";

export { STORAGE_CONDITIONS };
export type { StorageCondition };

export const LABEL_TYPES = ["ELABORATED", "HANDLED"] as const;

export type LabelType = (typeof LABEL_TYPES)[number];
