/** Milímetros → puntos PDF (1 pt = 1/72 in, 1 in = 25.4 mm). */
export const mm = (v: number): number => (v * 72) / 25.4;

/**
 * Especificación resuelta de una hoja A4 que consume `FoodLabelPdfService`.
 * Preset estándar built-in (no configurable) para impresoras láser normales.
 * Las etiquetas térmicas (Zebra) usan ZPL — ver `zpl-presets.ts`.
 */
export type LabelSpec = {
  kind: "a4";
  cols: number;
  rows: number;
  labelWmm: number;
  labelHmm: number;
  marginXmm: number;
  marginYmm: number;
  gutterXmm: number;
  gutterYmm: number;
  paddingMm: number;
  showIngredients: boolean;
};

export type A4Format = "a4-70x37" | "a4-63x38";

export const BUILTIN_A4_FORMATS: A4Format[] = ["a4-70x37", "a4-63x38"];

type A4Preset = LabelSpec & { name: string };

/**
 * Presets de hoja A4 estándar (referencias tipo Apli). Los márgenes/gutters son
 * afinables aquí con un PDF de prueba real sin tocar la lógica de render.
 */
export const A4_BUILTIN_PRESETS: Record<A4Format, A4Preset> = {
  "a4-70x37": {
    kind: "a4",
    name: "A4 · 70 × 37 mm (24/hoja)",
    cols: 3,
    rows: 8,
    labelWmm: 70,
    labelHmm: 37,
    marginXmm: 4,
    marginYmm: 4.5,
    gutterXmm: 0,
    gutterYmm: 0,
    paddingMm: 3,
    showIngredients: true,
  },
  "a4-63x38": {
    kind: "a4",
    name: "A4 · 63,5 × 38 mm (21/hoja)",
    cols: 3,
    rows: 7,
    labelWmm: 63.5,
    labelHmm: 38.1,
    marginXmm: 7.2,
    marginYmm: 15.1,
    gutterXmm: 2.5,
    gutterYmm: 0,
    paddingMm: 3,
    showIngredients: true,
  },
};

export const A4_SIZE_PT: [number, number] = [mm(210), mm(297)];
