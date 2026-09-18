import { LABEL_INGREDIENTS_MIN_HEIGHT_MM } from "./label-presets";

/** DPI por defecto de la Zebra ZD220D (203 dpi ≈ 8 dots/mm). */
export const DEFAULT_ZPL_DPI = 203;

/** Margen de seguridad (mm) dentro del área imprimible de la etiqueta térmica. */
export const ZPL_PADDING_MM = 2.5;

/** dots por mm para un DPI dado (203 dpi ⇒ ~8 dots/mm). */
export const dotsPerMm = (dpi: number): number => dpi / 25.4;

/** Milímetros → dots enteros, redondeando (posiciones/tamaños ZPL son enteros). */
export const toDots = (valueMm: number, dpi: number): number =>
  Math.round(valueMm * dotsPerMm(dpi));

/** Especificación resuelta de una etiqueta térmica Zebra que consume `FoodLabelZplService`. */
export interface ZplLabelSpec {
  widthMm: number;
  heightMm: number;
  /** DPI de la impresora (configurable por perfil en Ajustes; 203 por defecto). */
  dpi: number;
  paddingMm: number;
  showIngredients: boolean;
}

export function zplSpec(
  widthMm: number,
  heightMm: number,
  dpi: number = DEFAULT_ZPL_DPI,
): ZplLabelSpec {
  return {
    widthMm,
    heightMm,
    dpi,
    paddingMm: ZPL_PADDING_MM,
    showIngredients: heightMm >= LABEL_INGREDIENTS_MIN_HEIGHT_MM,
  };
}
