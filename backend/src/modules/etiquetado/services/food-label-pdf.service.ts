import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";
import * as QRCode from "qrcode";
import { A4_SIZE_PT, LabelSpec, mm } from "../constants/label-presets";
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

export type { FoodLabelForPrint as FoodLabelForPdf } from "../types/food-label-for-print.type";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

@Injectable()
export class FoodLabelPdfService {
  /** Genera un PDF A4 (rejilla de etiquetas para impresora láser). */
  async generate(
    label: FoodLabelForPrint,
    preset: LabelSpec,
    copies: number,
  ): Promise<Buffer> {
    const count = Math.min(Math.max(copies || 1, 1), 200);
    const qrPng = await QRCode.toBuffer(traceUrl(label.qrToken), {
      margin: 0,
      errorCorrectionLevel: "M",
      width: 240,
    });

    const doc = new PDFDocument({ size: A4_SIZE_PT, margin: 0 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));

    const perPage = preset.cols * preset.rows;
    for (let i = 0; i < count; i++) {
      const slot = i % perPage;
      if (i > 0 && slot === 0) {
        doc.addPage({ size: A4_SIZE_PT, margin: 0 });
      }
      const col = slot % preset.cols;
      const row = Math.floor(slot / preset.cols);
      const cellX =
        mm(preset.marginXmm) + col * mm(preset.labelWmm + preset.gutterXmm);
      const cellY =
        mm(preset.marginYmm) + row * mm(preset.labelHmm + preset.gutterYmm);
      const pad = mm(preset.paddingMm);
      this.renderLabel(
        doc,
        label,
        qrPng,
        {
          x: cellX + pad,
          y: cellY + pad,
          w: mm(preset.labelWmm) - pad * 2,
          h: mm(preset.labelHmm) - pad * 2,
        },
        preset,
      );
    }

    doc.end();
    await new Promise((resolve) => doc.on("end", resolve));
    return Buffer.concat(chunks);
  }

  private renderLabel(
    doc: PDFKit.PDFDocument,
    label: FoodLabelForPrint,
    qrPng: Buffer,
    box: Box,
    preset: LabelSpec,
  ): void {
    // QR arriba a la derecha, junto al nombre/lote (ahí sobraba espacio en
    // blanco); solo las líneas que caen a su altura se estrechan, el resto
    // recupera el ancho completo.
    const qrSize = Math.min(mm(15), box.h * 0.42, box.w * 0.42);
    const qrBottom = box.y + qrSize;
    const narrowW = box.w - qrSize - mm(1.5);
    let y = box.y;
    const w = (): number => (y < qrBottom - 2 ? narrowW : box.w);

    doc.fillColor("#000");

    // Nombre del producto (completo: admite varias líneas)
    doc.font("Helvetica-Bold").fontSize(7);
    y = this.wrappedLine(doc, label.itemName, box.x, y, w(), 8, 4);

    // Nº de lote (destacado) — nunca debe truncarse.
    doc.font("Helvetica-Bold").fontSize(8.5);
    y = this.line(doc, lotLine(label), box.x, y + 0.5, w(), 10);

    // Fechas
    doc.font("Helvetica").fontSize(6);
    y = this.line(doc, prepLine(label), box.x, y + 0.5, w(), 7);
    doc.font("Helvetica-Bold").fontSize(6.5);
    y = this.line(doc, consumeLine(label), box.x, y, w(), 7.5);

    doc.font("Helvetica").fontSize(6);
    y = this.line(doc, conservationLine(label), box.x, y + 0.5, w(), 7);

    const handledExtra = handledExtraLine(label);
    if (handledExtra) {
      doc.fontSize(5.5);
      y = this.line(doc, handledExtra, box.x, y, w(), 6.5);
    }

    // La línea de responsable va anclada abajo; el resto no debe invadirla.
    const bottomLimit = box.y + box.h - 7;

    // Alérgenos — nombres en texto (Reg. UE 1169/2011), en negrita.
    // Con nombres (no números) la lista es más larga: se deja envolver.
    const allergens = allergensLine(label);
    if (allergens) {
      doc.font("Helvetica-Bold").fontSize(5.5);
      y = this.wrappedLine(doc, allergens, box.x, y, w(), 6.5, 2);
    }

    // Ingredientes con lote (solo formatos grandes, ELABORATED). Se listan
    // TODOS con su nº de lote; el bloque se reparte en tantas líneas como
    // quepan hasta la línea de responsable.
    const ingredients = preset.showIngredients ? ingredientsLine(label) : null;
    if (ingredients) {
      doc.font("Helvetica").fontSize(5);
      const maxLines = Math.max(1, Math.floor((bottomLimit - y) / 6));
      y = this.wrappedLine(doc, ingredients, box.x, y, w(), 6, maxLines);
    }

    // Responsable (abajo del todo)
    doc.font("Helvetica").fontSize(5.5);
    doc.text(responsableLine(label), box.x, box.y + box.h - 6.5, {
      width: box.w,
      height: 6.5,
      lineBreak: false,
      ellipsis: true,
    });

    if (label.voidedAt) {
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#b8232c");
      doc.text("ANULADA", box.x, box.y + box.h / 2 - 5, {
        width: box.w,
        height: 11,
        align: "center",
        lineBreak: false,
      });
      doc.fillColor("#000");
    }

    // QR (esquina superior derecha)
    doc.image(qrPng, box.x + box.w - qrSize, box.y, {
      width: qrSize,
      height: qrSize,
    });
  }

  /**
   * Escribe una línea de texto en posición absoluta, sin salto de línea (para
   * que pdfkit no auto-pagine cerca del borde inferior de la hoja) y con
   * elipsis si no cabe. Devuelve la Y de la siguiente línea.
   */
  private line(
    doc: PDFKit.PDFDocument,
    text: string,
    x: number,
    y: number,
    w: number,
    lh: number,
  ): number {
    // `height` acota el bloque para que pdfkit no auto-pagine cuando la Y está
    // cerca del borde inferior de una hoja A4.
    doc.text(text, x, y, {
      width: w,
      height: lh,
      lineBreak: false,
      ellipsis: true,
    });
    return y + lh;
  }

  /**
   * Como `line` pero permitiendo salto de línea hasta `maxLines`, para texto
   * que no debe recortarse (el nombre del producto). Si aun así no cabe,
   * elipsis en la última línea visible.
   */
  private wrappedLine(
    doc: PDFKit.PDFDocument,
    text: string,
    x: number,
    y: number,
    w: number,
    lh: number,
    maxLines: number,
  ): number {
    const used = Math.min(
      doc.heightOfString(text, { width: w }),
      maxLines * lh,
    );
    doc.text(text, x, y, {
      width: w,
      height: used,
      lineBreak: true,
      ellipsis: true,
    });
    return y + used;
  }
}
