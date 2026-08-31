import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";
import * as QRCode from "qrcode";
import type { FoodLabel, FoodLabelIngredientLot, Lot } from "@prisma/client";
import { A4_SIZE_PT, LabelSpec, mm } from "../constants/label-presets";

export type FoodLabelForPdf = FoodLabel & {
  ingredientLots: FoodLabelIngredientLot[];
  sourceLot:
    | (Pick<Lot, "lotNumber"> & { supplier: { name: string } | null })
    | null;
};

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const STORAGE_LABEL: Record<string, string> = {
  REFRIGERATED: "REFRIGERADO",
  FROZEN: "CONGELADO",
  AMBIENT: "TEMP. AMBIENTE",
};

@Injectable()
export class FoodLabelPdfService {
  /** URL pública que abre el QR (ficha de trazabilidad sin login). */
  private traceUrl(qrToken: string): string {
    const base = (process.env.APP_URL || "http://localhost:3000").replace(
      /\/$/,
      "",
    );
    return `${base}/e/${qrToken}`;
  }

  async generate(
    label: FoodLabelForPdf,
    preset: LabelSpec,
    copies: number,
  ): Promise<Buffer> {
    const count = Math.min(Math.max(copies || 1, 1), 200);
    const qrPng = await QRCode.toBuffer(this.traceUrl(label.qrToken), {
      margin: 0,
      errorCorrectionLevel: "M",
      width: 240,
    });

    const doc =
      preset.kind === "thermal"
        ? new PDFDocument({
            size: [mm(preset.widthMm), mm(preset.heightMm)],
            margin: 0,
          })
        : new PDFDocument({ size: A4_SIZE_PT, margin: 0 });

    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));

    if (preset.kind === "thermal") {
      for (let i = 0; i < count; i++) {
        if (i > 0) {
          doc.addPage({
            size: [mm(preset.widthMm), mm(preset.heightMm)],
            margin: 0,
          });
        }
        const pad = mm(preset.paddingMm);
        this.renderLabel(
          doc,
          label,
          qrPng,
          {
            x: pad,
            y: pad,
            w: mm(preset.widthMm) - pad * 2,
            h: mm(preset.heightMm) - pad * 2,
          },
          preset,
        );
      }
    } else {
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
    }

    doc.end();
    await new Promise((resolve) => doc.on("end", resolve));
    return Buffer.concat(chunks);
  }

  private renderLabel(
    doc: PDFKit.PDFDocument,
    label: FoodLabelForPdf,
    qrPng: Buffer,
    box: Box,
    preset: LabelSpec,
  ): void {
    // QR abajo a la derecha; solo las líneas que caen a su altura se estrechan.
    const qrSize = Math.min(mm(15), box.h * 0.42, box.w * 0.42);
    const qrTop = box.y + box.h - qrSize;
    const narrowW = box.w - qrSize - mm(1.5);
    let y = box.y;
    const w = (): number => (y >= qrTop - 2 ? narrowW : box.w);

    doc.fillColor("#000");

    // Nombre del producto
    doc.font("Helvetica-Bold").fontSize(7);
    y = this.line(doc, label.itemName, box.x, y, box.w, 8);

    // Nº de lote (destacado) — nunca debe truncarse
    doc.font("Helvetica-Bold").fontSize(8.5);
    y = this.line(doc, `LOTE ${label.lotNumber}`, box.x, y + 0.5, box.w, 10);

    // Fechas
    const prep = this.fmtDateTime(label.preparedAt);
    const useBy = this.fmtDate(label.useByDate);
    const prepWord = label.labelType === "ELABORATED" ? "Elab." : "Manip.";
    doc.font("Helvetica").fontSize(6);
    y = this.line(doc, `${prepWord}: ${prep}`, box.x, y + 0.5, w(), 7);
    doc.font("Helvetica-Bold").fontSize(6.5);
    y = this.line(doc, `Consumo pref.: ${useBy}`, box.x, y, w(), 7.5);

    if (label.frozenUseByDate) {
      doc.font("Helvetica").fontSize(5.5);
      y = this.line(
        doc,
        `Congelado ${this.fmtDate(label.frozenAt)} · consumir ${this.fmtDate(label.frozenUseByDate)}`,
        box.x,
        y,
        w(),
        6.5,
      );
    }

    // Conservación
    doc.font("Helvetica").fontSize(6);
    y = this.line(doc, this.storageText(label), box.x, y + 0.5, w(), 7);

    // HANDLED: proveedor + caducidad fabricante
    if (label.labelType === "HANDLED") {
      const supplier = label.sourceLot?.supplier?.name;
      const parts: string[] = [];
      if (supplier) {
        parts.push(`Prov.: ${supplier}`);
      }
      if (label.manufacturerExpiryDate) {
        parts.push(
          `Cad. fábrica: ${this.fmtDate(label.manufacturerExpiryDate)}`,
        );
      }
      if (parts.length) {
        doc.fontSize(5.5);
        y = this.line(doc, parts.join(" · "), box.x, y, w(), 6.5);
      }
    }

    // Alérgenos
    if (label.allergens.length) {
      doc.font("Helvetica-Oblique").fontSize(5.5);
      y = this.line(
        doc,
        `Alérgenos (cód. UE): ${label.allergens.join(", ")}`,
        box.x,
        y,
        w(),
        6.5,
      );
    }

    // Ingredientes con lote (solo formatos grandes, ELABORATED)
    if (
      preset.showIngredients &&
      label.labelType === "ELABORATED" &&
      label.ingredientLots.length
    ) {
      const txt =
        "Ingr.: " +
        label.ingredientLots
          .map((il) =>
            il.lotNumber
              ? `${il.productName} (L:${il.lotNumber})`
              : il.productName,
          )
          .join(", ");
      doc.font("Helvetica").fontSize(5);
      y = this.line(doc, txt, box.x, y, narrowW, 6);
    }

    // Responsable (abajo del todo)
    doc.font("Helvetica").fontSize(5.5);
    doc.text(`Resp.: ${label.createdByName}`, box.x, box.y + box.h - 6.5, {
      width: narrowW,
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

    // QR (esquina inferior derecha)
    doc.image(qrPng, box.x + box.w - qrSize, qrTop, {
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

  private storageText(label: FoodLabelForPdf): string {
    const cond =
      STORAGE_LABEL[label.storageCondition] ?? label.storageCondition;
    const min = label.storageTempMin;
    const max = label.storageTempMax;
    if (min !== null && max !== null) {
      return `${cond}  ${min}–${max} °C`;
    }
    if (max !== null) {
      return `${cond}  ≤ ${max} °C`;
    }
    return cond;
  }

  private fmtDate(d: Date | null): string {
    if (!d) {
      return "—";
    }
    return new Intl.DateTimeFormat("es-ES", {
      timeZone: "Europe/Madrid",
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    }).format(d);
  }

  private fmtDateTime(d: Date | null): string {
    if (!d) {
      return "—";
    }
    return new Intl.DateTimeFormat("es-ES", {
      timeZone: "Europe/Madrid",
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  }
}
