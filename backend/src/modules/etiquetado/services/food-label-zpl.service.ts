import { Injectable } from "@nestjs/common";
import * as QRCode from "qrcode";
import { toDots, ZplLabelSpec } from "../constants/zpl-presets";
import {
  computeZplLayout,
  type ZplFieldLayout,
} from "../util/food-label-zpl-layout.util";
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
 * La magnificación del QR se deriva del nº de módulos REAL que la propia
 * librería `qrcode` calcula para el contenido exacto (URL de trazabilidad) y
 * el nivel de corrección de errores — el mismo algoritmo estándar (ISO/IEC
 * 18004) que usa el firmware de la Zebra, así que el nº de módulos coincide
 * con el que imprime la impresora. No se asume/adivina un nº de módulos fijo.
 * El tamaño físico objetivo vive en el layout (`food-label-zpl-layout.util`).
 */
const QR_ERROR_CORRECTION = "M"; // Medium, igual que el QR del PDF

const MAX_COPIES = 200;

/** ZPL reserva `^` y `~` como prefijos de comando: no pueden ir en `^FD...^FS`. */
function sanitizeZplText(text: string): string {
  return text.replace(/[\^~]/g, "");
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
    // Etiquetas compactas (57×32) no llevan QR: no hace falta calcularlo.
    const qrModules = spec.compact
      ? 0
      : QRCode.create(sanitizeZplText(qrData), {
          errorCorrectionLevel: QR_ERROR_CORRECTION,
        }).modules.size;

    const extra = handledExtraLine(label);
    const allergens = allergensLine(label);
    const ingredients = ingredientsLine(label);

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
    if (ingredients && layout.ingredients.maxLines > 0) {
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
    if (layout.qr) {
      out.push(
        `^FO${layout.qr.x},${layout.qr.y}^BQN,2,${layout.qr.magnification}^FD${QR_ERROR_CORRECTION}A,${sanitizeZplText(qrData)}^FS`,
      );
    }

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
