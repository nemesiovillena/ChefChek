import { Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import type {
  GestionCell,
  GestionColumn,
  GestionExportFormat,
  GestionTable,
} from "./gestion-table.types";

const fmt = (n: number, decimals: number) =>
  n.toLocaleString("es-ES", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

/** Texto de una celda tal y como se ve en pantalla (PDF). */
function display(column: GestionColumn, value: GestionCell): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  switch (column.kind) {
    // La fuente estándar de pdfkit dibuja mal «€»: se pone «EUR».
    case "euros":
      return `${fmt(value, 2)} EUR`;
    case "percent":
      return `${fmt(value, 1)} %`;
    case "int":
      return fmt(value, 0);
    default:
      return value.toLocaleString("es-ES", { maximumFractionDigits: 2 });
  }
}

const allRows = (table: GestionTable) =>
  table.totals ? [...table.rows, table.totals] : table.rows;

/**
 * Exporta cualquier informe de Gestión (misma tabla que en pantalla) a CSV
 * con «;» para Excel en español, a Excel con números de verdad y a PDF.
 */
@Injectable()
export class GestionTableExportService {
  toCsv(table: GestionTable): Buffer {
    const escape = (value: string) => {
      // Un texto que empieza por =, +, - o @ lo ejecutaría Excel como fórmula.
      const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
      return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    // Los números no se protegen: «-12,5» debe seguir siendo un número en Excel.
    const cell = (v: GestionCell) =>
      v === null || v === undefined
        ? ""
        : typeof v === "number"
          ? String(v).replace(".", ",")
          : escape(v);
    const lines = [
      table.columns.map((c) => escape(c.label)),
      ...allRows(table).map((r) => table.columns.map((c) => cell(r[c.key]))),
    ].map((r) => r.join(";"));
    return Buffer.from(`﻿${lines.join("\r\n")}\r\n`, "utf8");
  }

  async toXlsx(table: GestionTable): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(table.title.slice(0, 31));
    sheet.addRow([table.title]).font = { bold: true, size: 13 };
    sheet.addRow([table.subtitle]);
    const head = sheet.addRow(table.columns.map((c) => c.label));
    head.font = { bold: true };
    head.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE5E7EB" },
    };
    for (const r of table.rows) {
      sheet.addRow(table.columns.map((c) => xlsxValue(c, r[c.key])));
    }
    if (table.totals) {
      sheet.addRow(
        table.columns.map((c) => xlsxValue(c, table.totals?.[c.key] ?? null)),
      ).font = { bold: true };
    }
    table.columns.forEach((c, i) => {
      const col = sheet.getColumn(i + 1);
      col.width = c.kind === "text" ? 34 : 16;
      if (c.kind === "euros") {
        col.numFmt = '#,##0.00 "€"';
      }
      if (c.kind === "percent") {
        col.numFmt = "0.0%";
      }
      if (c.kind === "qty") {
        col.numFmt = "#,##0.##";
      }
      if (c.kind === "int") {
        col.numFmt = "#,##0";
      }
    });
    sheet.views = [{ state: "frozen", ySplit: 3 }];
    for (const note of table.notes) {
      sheet.addRow([note]).font = { italic: true };
    }
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  toPdf(table: GestionTable): Promise<Buffer> {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 36,
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) =>
      doc.on("end", () => resolve(Buffer.concat(chunks))),
    );

    doc.fontSize(14).font("Helvetica-Bold").text(table.title);
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#555555")
      .text(table.subtitle)
      .fillColor("#000000");
    doc.moveDown(0.5);

    // 770 pt útiles en A4 apaisado: las columnas de texto se llevan el doble.
    const weights = table.columns.map((c) => (c.kind === "text" ? 2 : 1));
    const unit = 770 / weights.reduce((a, b) => a + b, 0);
    const widths = weights.map((w) => w * unit);
    const left = doc.page.margins.left;
    const drawRow = (cells: string[], bold = false) => {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 20) {
        doc.addPage();
      }
      const y = doc.y;
      let x = left;
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8);
      cells.forEach((text, i) => {
        doc.text(text, x, y, {
          width: widths[i] - 4,
          align: table.columns[i].kind === "text" ? "left" : "right",
          lineBreak: false,
          ellipsis: true,
        });
        x += widths[i];
      });
      doc.x = left;
      doc.y = y + 13;
    };
    drawRow(
      table.columns.map((c) => c.label),
      true,
    );
    doc
      .moveTo(left, doc.y - 2)
      .lineTo(left + 770, doc.y - 2)
      .stroke("#999999");
    for (const r of table.rows) {
      drawRow(table.columns.map((c) => display(c, r[c.key])));
    }
    if (table.totals) {
      drawRow(
        table.columns.map((c) => display(c, table.totals?.[c.key] ?? null)),
        true,
      );
    }
    for (const note of table.notes) {
      doc
        .moveDown(0.5)
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#555555")
        .text(note, left)
        .fillColor("#000000");
    }
    doc.end();
    return done;
  }

  async export(
    table: GestionTable,
    format: GestionExportFormat,
  ): Promise<Buffer> {
    if (format === "csv") {
      return this.toCsv(table);
    }
    if (format === "xlsx") {
      return this.toXlsx(table);
    }
    return this.toPdf(table);
  }

  fileName(table: GestionTable, format: GestionExportFormat): string {
    const slug = `${table.title} ${table.subtitle}`
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
      .slice(0, 90);
    return `${slug || "informe"}.${format}`;
  }
}

/** Excel guarda los % como fracción (12,5 % → 0,125) para su formato «0.0%». */
function xlsxValue(column: GestionColumn, value: GestionCell): GestionCell {
  if (column.kind === "percent" && typeof value === "number") {
    return value / 100;
  }
  return value ?? null;
}
