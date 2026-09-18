import { Injectable } from "@nestjs/common";
import * as QRCode from "qrcode";
import { toDots, ZplLabelSpec } from "../constants/zpl-presets";
import type { FoodLabelForPrint } from "../types/food-label-for-print.type";
import { traceUrl } from "../util/trace-url.util";
import {
  allergensLine,
  conservationLine,
  consumeLine,
  handledExtraLine,
  ingredientsLine,
  lotLine,
  prepLine,
  responsableLine,
} from "../util/food-label-print-format.util";

/**
 * Tamaño físico de QR objetivo (mm). La magnificación se deriva del nº de
 * módulos REAL que la propia librería `qrcode` calcula para el contenido
 * exacto (URL de trazabilidad) y el nivel de corrección de errores — el
 * mismo algoritmo estándar (ISO/IEC 18004) que usa el firmware de la Zebra,
 * así que el nº de módulos coincide con el que imprime la impresora. No se
 * asume/adivina un nº de módulos fijo.
 */
const QR_TARGET_MM = 15;
const QR_ERROR_CORRECTION = "M"; // Medium, igual que el QR del PDF

const MAX_COPIES = 200;

/** ZPL reserva `^` y `~` como prefijos de comando: no pueden ir en `^FD...^FS`. */
function sanitizeZplText(text: string): string {
  return text.replace(/[\^~]/g, "");
}

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
 * ajustes de tamaño/posición se hacen tocando las constantes `*_MM` de este
 * archivo (no la lógica de generación) — este objeto es lo que hay que
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
  /** Solo se imprime si `hasIngredients`. */
  ingredients: ZplFieldLayout;
  responsable: ZplFieldLayout;
  qr: { x: number; y: number; magnification: number; modules: number };
}

export interface ZplLayoutContent {
  qrModules: number;
  hasHandledExtra: boolean;
  hasAllergens: boolean;
}

// Tamaños de fuente/línea (mm) por campo — únicos números a tocar tras una
// prueba de impresión real. Ver plan `260917-1445-etiquetas-zpl-zebra`.
const PRODUCT_FONT_MM = 2.4;
const PRODUCT_LINE_MM = 3.0;
const PRODUCT_MAX_LINES = 2;
const LOT_FONT_MM = 3.0;
const LOT_LINE_MM = 3.6;
const PREP_FONT_MM = 2.0;
const PREP_LINE_MM = 2.5;
const CONSUME_FONT_MM = 2.2;
const CONSUME_LINE_MM = 2.7;
const CONSERVATION_FONT_MM = 2.0;
const CONSERVATION_LINE_MM = 2.5;
const HANDLED_EXTRA_FONT_MM = 1.7;
const HANDLED_EXTRA_LINE_MM = 2.2;
const ALLERGENS_FONT_MM = 1.8;
const ALLERGENS_LINE_MM = 2.3;
const ALLERGENS_MAX_LINES = 2;
const INGREDIENTS_FONT_MM = 1.6;
const INGREDIENTS_LINE_MM = 2.0;
const INGREDIENTS_MAX_LINES = 4;
const RESPONSABLE_FONT_MM = 1.8;
const RESPONSABLE_HEIGHT_MM = 2.6;
const QR_GAP_MM = 1.5;

/**
 * Calcula la geometría (posiciones/tamaños en dots) de cada campo para un
 * `spec` y el contenido concreto de la etiqueta (nº de módulos de QR ya
 * resuelto + qué campos opcionales aparecen, para que el resto cierre el
 * hueco). Función pura, sin ZPL — es la "plantilla de prueba" para calibrar
 * en la Zebra física ajustando solo las constantes `*_MM` de arriba.
 */
export function computeZplLayout(
  spec: ZplLabelSpec,
  content: ZplLayoutContent,
): ZplLayout {
  const d = (valueMm: number) => toDots(valueMm, spec.dpi);
  const widthDots = d(spec.widthMm);
  const heightDots = d(spec.heightMm);
  const pad = d(spec.paddingMm);
  const x0 = pad;
  const contentW = widthDots - pad * 2;
  const contentH = heightDots - pad * 2;

  const qrMagnification = Math.max(
    2,
    Math.round(d(QR_TARGET_MM) / content.qrModules),
  );
  const qrSize = qrMagnification * content.qrModules;
  const qrX = x0 + contentW - qrSize;
  const qrBottom = pad + qrSize;
  const gap = d(QR_GAP_MM);
  const narrowW = contentW - qrSize - gap;
  const widthAt = (y: number): number => (y < qrBottom ? narrowW : contentW);

  let y = pad;

  const product: ZplFieldLayout = {
    x: x0,
    y,
    fontHeightDots: d(PRODUCT_FONT_MM),
    widthDots: widthAt(y),
    maxLines: PRODUCT_MAX_LINES,
    bold: true,
  };
  y += d(PRODUCT_LINE_MM) * PRODUCT_MAX_LINES;

  const lot: ZplFieldLayout = {
    x: x0,
    y,
    fontHeightDots: d(LOT_FONT_MM),
    widthDots: widthAt(y),
    maxLines: 1,
    bold: true,
  };
  y += d(LOT_LINE_MM);

  const prep: ZplFieldLayout = {
    x: x0,
    y,
    fontHeightDots: d(PREP_FONT_MM),
    widthDots: widthAt(y),
    maxLines: 1,
    bold: false,
  };
  y += d(PREP_LINE_MM);

  const consume: ZplFieldLayout = {
    x: x0,
    y,
    fontHeightDots: d(CONSUME_FONT_MM),
    widthDots: widthAt(y),
    maxLines: 1,
    bold: true,
  };
  y += d(CONSUME_LINE_MM);

  const conservation: ZplFieldLayout = {
    x: x0,
    y,
    fontHeightDots: d(CONSERVATION_FONT_MM),
    widthDots: widthAt(y),
    maxLines: 1,
    bold: false,
  };
  y += d(CONSERVATION_LINE_MM);

  const handledExtra: ZplFieldLayout = {
    x: x0,
    y,
    fontHeightDots: d(HANDLED_EXTRA_FONT_MM),
    widthDots: widthAt(y),
    maxLines: 1,
    bold: false,
  };
  if (content.hasHandledExtra) {
    y += d(HANDLED_EXTRA_LINE_MM);
  }

  // Alérgenos: si hay línea HANDLED, va debajo; si no (caso ELABORATED, el
  // más común), sube a ocupar ese hueco — se resuelve aquí con `content`,
  // sin ambigüedad para quien consuma este layout.
  const allergens: ZplFieldLayout = {
    x: x0,
    y,
    fontHeightDots: d(ALLERGENS_FONT_MM),
    widthDots: widthAt(y),
    maxLines: ALLERGENS_MAX_LINES,
    bold: true,
  };
  if (content.hasAllergens) {
    y += d(ALLERGENS_LINE_MM) * ALLERGENS_MAX_LINES;
  }

  const ingredients: ZplFieldLayout = {
    x: x0,
    y,
    fontHeightDots: d(INGREDIENTS_FONT_MM),
    widthDots: widthAt(y),
    maxLines: INGREDIENTS_MAX_LINES,
    bold: false,
  };

  const responsable: ZplFieldLayout = {
    x: x0,
    y: pad + contentH - d(RESPONSABLE_HEIGHT_MM),
    fontHeightDots: d(RESPONSABLE_FONT_MM),
    widthDots: contentW,
    maxLines: 1,
    bold: false,
  };

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
    qr: {
      x: qrX,
      y: pad,
      magnification: qrMagnification,
      modules: content.qrModules,
    },
  };
}

@Injectable()
export class FoodLabelZplService {
  /** Genera el ZPL (texto plano) de una etiqueta térmica Zebra. Sin dependencias de hardware. */
  generate(
    label: FoodLabelForPrint,
    spec: ZplLabelSpec,
    copies: number,
  ): string {
    const qrData = traceUrl(label.qrToken);
    const qrModules = QRCode.create(sanitizeZplText(qrData), {
      errorCorrectionLevel: QR_ERROR_CORRECTION,
    }).modules.size;

    const extra = handledExtraLine(label);
    const allergens = allergensLine(label);
    const ingredients = spec.showIngredients ? ingredientsLine(label) : null;

    const layout = computeZplLayout(spec, {
      qrModules,
      hasHandledExtra: !!extra,
      hasAllergens: !!allergens,
    });

    const out: string[] = [
      "^XA",
      "^CI28",
      `^PW${layout.widthDots}`,
      `^LL${layout.heightDots}`,
      "^LH0,0",
    ];

    out.push(this.field(layout.product, label.itemName));
    out.push(this.field(layout.lot, lotLine(label)));
    out.push(this.field(layout.prep, prepLine(label)));
    out.push(this.field(layout.consume, consumeLine(label)));
    out.push(this.field(layout.conservation, conservationLine(label)));
    if (extra) {
      out.push(this.field(layout.handledExtra, extra));
    }
    if (allergens) {
      out.push(this.field(layout.allergens, allergens));
    }
    if (ingredients) {
      out.push(this.field(layout.ingredients, ingredients));
    }
    out.push(this.field(layout.responsable, responsableLine(label)));

    if (label.voidedAt) {
      const vH = toDots(3.2, spec.dpi);
      const contentH = layout.heightDots - layout.padDots * 2;
      const vY = layout.padDots + Math.round(contentH / 2) - Math.round(vH / 2);
      const vW = layout.widthDots - layout.padDots * 2;
      out.push(
        `^FO${layout.padDots},${vY}^A0N,${vH},${vH}^FB${vW},1,0,C,0^FD${sanitizeZplText("ANULADA")}^FS`,
      );
    }

    // QR (esquina superior derecha), dinámico por lote vía `traceUrl`.
    out.push(
      `^FO${layout.qr.x},${layout.qr.y}^BQN,2,${layout.qr.magnification}^FD${QR_ERROR_CORRECTION}A,${sanitizeZplText(qrData)}^FS`,
    );

    const qty = Math.min(Math.max(copies || 1, 1), MAX_COPIES);
    if (qty > 1) {
      out.push(`^PQ${qty}`);
    }
    out.push("^XZ");
    return out.join("\n");
  }

  /**
   * Campo de texto en bloque (`^FB`, ajusta y corta sin elipsis si no cabe en
   * `maxLines`). `bold` reimprime el campo desplazado 1 dot en X: la fuente
   * escalable 0 de Zebra no tiene variante negrita real, esto es el truco
   * estándar de "doble impresión" para simularla.
   */
  private field(layout: ZplFieldLayout, text: string): string {
    const safe = sanitizeZplText(text);
    const at = (fx: number): string =>
      `^FO${fx},${layout.y}^A0N,${layout.fontHeightDots},${layout.fontHeightDots}^FB${layout.widthDots},${layout.maxLines},0,L,0^FD${safe}^FS`;
    return layout.bold ? `${at(layout.x)}\n${at(layout.x + 1)}` : at(layout.x);
  }
}
