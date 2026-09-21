import { toDots, ZplLabelSpec } from "../constants/zpl-presets";

export interface ZplFieldLayout {
  x: number;
  y: number;
  fontHeightDots: number;
  widthDots: number;
  maxLines: number;
  bold: boolean;
}

/**
 * Plantilla de calibración: posición/tamaño de cada campo en dots, ya
 * resuelta para un `ZplLabelSpec` + contenido concreto (nº de módulos de QR,
 * y qué campos opcionales aparecen). Cuando se pruebe en la Zebra física, los
 * ajustes de tamaño/posición se hacen tocando las constantes `*_TUNING` de
 * este archivo (no la lógica de generación) — este objeto es lo que hay que
 * inspeccionar/loggear para calibrar.
 */
export interface ZplLayout {
  widthDots: number;
  heightDots: number;
  dpi: number;
  padDots: number;
  product: ZplFieldLayout;
  lot: ZplFieldLayout;
  prep: ZplFieldLayout;
  consume: ZplFieldLayout;
  conservation: ZplFieldLayout;
  /** Solo se imprime si `hasHandledExtra`. */
  handledExtra: ZplFieldLayout;
  /** Solo se imprime si `hasAllergens`. */
  allergens: ZplFieldLayout;
  /** Ocupa todo el hueco libre; `maxLines` 0 = no cabe ninguna línea. */
  ingredients: ZplFieldLayout;
  responsable: ZplFieldLayout;
  /** Null en etiquetas compactas (sin QR). */
  qr: { x: number; y: number; magnification: number; modules: number } | null;
}

export interface ZplLayoutContent {
  /** Módulos reales del QR codificado; ignorado en etiquetas compactas. */
  qrModules: number;
  hasHandledExtra: boolean;
  hasAllergens: boolean;
}

/** Tamaño de fuente y alto de línea (mm) de un campo. */
interface FieldMetrics {
  fontMm: number;
  lineMm: number;
}

/**
 * Tipografía/espaciado de cada formato — únicos números a tocar tras una
 * prueba de impresión real. `standard` (60×40: con QR) y `compact` (57×32:
 * sin QR, todo el ancho para texto e ingredientes). Ver `ZPL_COMPACT_MAX_HEIGHT_MM`.
 */
interface ZplLayoutTuning {
  /** Tamaño físico objetivo del QR (mm). */
  qrTargetMm: number;
  qrGapMm: number;
  product: FieldMetrics & { maxLines: number };
  lot: FieldMetrics;
  prep: FieldMetrics;
  consume: FieldMetrics;
  conservation: FieldMetrics;
  handledExtra: FieldMetrics;
  allergens: FieldMetrics & { maxLines: number };
  ingredients: FieldMetrics;
  responsable: { fontMm: number; heightMm: number };
}

const STANDARD_TUNING: ZplLayoutTuning = {
  qrTargetMm: 15,
  qrGapMm: 1.5,
  product: { fontMm: 2.4, lineMm: 3.0, maxLines: 2 },
  lot: { fontMm: 3.0, lineMm: 3.6 },
  prep: { fontMm: 2.0, lineMm: 2.5 },
  consume: { fontMm: 2.2, lineMm: 2.7 },
  conservation: { fontMm: 2.0, lineMm: 2.5 },
  handledExtra: { fontMm: 1.7, lineMm: 2.2 },
  allergens: { fontMm: 1.8, lineMm: 2.3, maxLines: 2 },
  ingredients: { fontMm: 1.6, lineMm: 2.0 },
  responsable: { fontMm: 1.8, heightMm: 2.6 },
};

const COMPACT_TUNING: ZplLayoutTuning = {
  qrTargetMm: 0,
  qrGapMm: 0,
  product: { fontMm: 2.2, lineMm: 2.6, maxLines: 2 },
  lot: { fontMm: 2.6, lineMm: 3.0 },
  prep: { fontMm: 1.8, lineMm: 2.3 },
  consume: { fontMm: 2.0, lineMm: 2.5 },
  conservation: { fontMm: 1.8, lineMm: 2.3 },
  handledExtra: { fontMm: 1.5, lineMm: 2.0 },
  allergens: { fontMm: 1.6, lineMm: 2.0, maxLines: 2 },
  ingredients: { fontMm: 1.5, lineMm: 1.85 },
  responsable: { fontMm: 1.6, heightMm: 2.4 },
};

/**
 * Calcula la geometría (posiciones/tamaños en dots) de cada campo para un
 * `spec` y el contenido concreto de la etiqueta (nº de módulos de QR ya
 * resuelto + qué campos opcionales aparecen, para que el resto cierre el
 * hueco). Función pura, sin ZPL — es la "plantilla de prueba" para calibrar
 * en la Zebra física ajustando solo las constantes `*_TUNING` de arriba.
 */
export function computeZplLayout(
  spec: ZplLabelSpec,
  content: ZplLayoutContent,
): ZplLayout {
  const tuning = spec.compact ? COMPACT_TUNING : STANDARD_TUNING;
  const d = (valueMm: number) => toDots(valueMm, spec.dpi);
  const widthDots = d(spec.widthMm);
  const heightDots = d(spec.heightMm);
  const pad = d(spec.paddingMm);
  const x0 = pad;
  const contentW = widthDots - pad * 2;
  const contentH = heightDots - pad * 2;

  // QR (esquina superior derecha) solo en etiquetas estándar; en compactas
  // ese hueco se dedica al texto a todo el ancho.
  let qr: ZplLayout["qr"] = null;
  let qrSize = 0;
  if (!spec.compact) {
    const magnification = Math.max(
      2,
      Math.round(d(tuning.qrTargetMm) / content.qrModules),
    );
    qrSize = magnification * content.qrModules;
    qr = {
      x: x0 + contentW - qrSize,
      y: pad,
      magnification,
      modules: content.qrModules,
    };
  }
  const qrBottom = pad + qrSize;
  const narrowW = contentW - qrSize - (qr ? d(tuning.qrGapMm) : 0);
  const widthAt = (y: number): number => (y < qrBottom ? narrowW : contentW);

  let y = pad;
  const field = (
    metrics: FieldMetrics,
    opts: { maxLines: number; bold: boolean },
  ): ZplFieldLayout => ({
    x: x0,
    y,
    fontHeightDots: d(metrics.fontMm),
    widthDots: widthAt(y),
    maxLines: opts.maxLines,
    bold: opts.bold,
  });

  const product = field(tuning.product, {
    maxLines: tuning.product.maxLines,
    bold: true,
  });
  y += d(tuning.product.lineMm) * tuning.product.maxLines;

  const lot = field(tuning.lot, { maxLines: 1, bold: true });
  y += d(tuning.lot.lineMm);

  const prep = field(tuning.prep, { maxLines: 1, bold: false });
  y += d(tuning.prep.lineMm);

  const consume = field(tuning.consume, { maxLines: 1, bold: true });
  y += d(tuning.consume.lineMm);

  const conservation = field(tuning.conservation, {
    maxLines: 1,
    bold: false,
  });
  y += d(tuning.conservation.lineMm);

  const handledExtra = field(tuning.handledExtra, {
    maxLines: 1,
    bold: false,
  });
  if (content.hasHandledExtra) {
    y += d(tuning.handledExtra.lineMm);
  }

  // Alérgenos: si hay línea HANDLED, va debajo; si no (caso ELABORATED, el
  // más común), sube a ocupar ese hueco — se resuelve aquí con `content`,
  // sin ambigüedad para quien consuma este layout.
  const allergens = field(tuning.allergens, {
    maxLines: tuning.allergens.maxLines,
    bold: true,
  });
  if (content.hasAllergens) {
    y += d(tuning.allergens.lineMm) * tuning.allergens.maxLines;
  }

  const responsableY = pad + contentH - d(tuning.responsable.heightMm);
  const responsable: ZplFieldLayout = {
    x: x0,
    y: responsableY,
    fontHeightDots: d(tuning.responsable.fontMm),
    widthDots: contentW,
    maxLines: 1,
    bold: false,
  };

  // Ingredientes: tantas líneas como quepan entre el último campo y el
  // responsable (más líneas en 60×40 que en 57×32 sin tocar constantes).
  const ingredients = field(tuning.ingredients, {
    maxLines: Math.max(
      0,
      Math.floor((responsableY - y) / d(tuning.ingredients.lineMm)),
    ),
    bold: false,
  });

  return {
    widthDots,
    heightDots,
    dpi: spec.dpi,
    padDots: pad,
    product,
    lot,
    prep,
    consume,
    conservation,
    handledExtra,
    allergens,
    ingredients,
    responsable,
    qr,
  };
}
