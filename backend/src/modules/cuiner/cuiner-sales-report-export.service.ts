import { Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { DISH_LEVEL, dayLabel } from "./cuiner-sales-report-grouping";
import { SalesReport, SalesReportAmounts } from "./cuiner-sales-report.service";

export const SALES_REPORT_FORMATS = ["xlsx", "csv", "pdf"] as const;
export type SalesReportFormat = (typeof SALES_REPORT_FORMATS)[number];

export const SALES_REPORT_CONTENT_TYPES: Record<SalesReportFormat, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv; charset=utf-8",
};

const LEVEL_NAMES: Record<number, string> = {
  1: "Familia",
  2: "Subfamilia",
  3: "Sección",
  4: "Plato",
};

const euros = (n: number) =>
  n.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const qty = (n: number) =>
  n.toLocaleString("es-ES", { maximumFractionDigits: 2 });

type Line = {
  period: string;
  label: string;
  family: string;
  amounts: SalesReportAmounts;
  share: number | null;
  /** Fila de subtotal (periodo) o total general. */
  kind: "row" | "subtotal" | "total";
};

/** Filas planas comunes a los tres formatos: detalle, subtotal por periodo y total. */
function flatten(report: SalesReport): Line[] {
  const lines: Line[] = [];
  for (const period of report.periods) {
    for (const row of period.rows) {
      lines.push({
        period: period.label,
        label: row.label,
        family: row.family ?? "",
        amounts: row,
        share: row.share,
        kind: "row",
      });
    }
    if (report.periods.length > 1) {
      lines.push({
        period: period.label,
        label: "Total del periodo",
        family: "",
        amounts: period.totals,
        share: null,
        kind: "subtotal",
      });
    }
  }
  lines.push({
    period: "",
    label: "TOTAL",
    family: "",
    amounts: report.totals,
    share: null,
    kind: "total",
  });
  return lines;
}

const isDishLevel = (report: SalesReport) => report.query.level >= DISH_LEVEL;

function headers(report: SalesReport): string[] {
  return [
    "Periodo",
    LEVEL_NAMES[report.query.level] ?? "Familia",
    ...(isDishLevel(report) ? ["Familia del plato"] : []),
    "Unidades",
    "Invitaciones",
    "Base sin IVA (€)",
    "Total con IVA (€)",
    "% del periodo",
  ];
}

const title = (report: SalesReport) => {
  const { from, to, family } = report.query;
  const range =
    from === to ? dayLabel(from) : `${dayLabel(from)} – ${dayLabel(to)}`;
  return `Ventas ${range}${family ? ` · ${family.split("-").join(" › ")}` : ""}`;
};

/**
 * Exportadores del informe de ventas. Parten del informe ya calculado: los
 * tres formatos muestran exactamente lo mismo que la pantalla.
 */
@Injectable()
export class CuinerSalesReportExportService {
  /** CSV con «;» y BOM: se abre bien en Excel en español. */
  toCsv(report: SalesReport): Buffer {
    const escape = (value: string) => {
      // Un texto que empieza por =, +, - o @ lo ejecutaría Excel como fórmula.
      const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
      return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const number = (n: number) => String(n).replace(".", ",");
    const rows = flatten(report).map((l) => [
      l.period,
      l.label,
      ...(isDishLevel(report) ? [l.family] : []),
      number(l.amounts.units),
      number(l.amounts.invitedUnits),
      number(l.amounts.base),
      number(l.amounts.total),
      l.share === null ? "" : number(l.share),
    ]);
    const lines = [headers(report), ...rows].map((r) =>
      r.map(escape).join(";"),
    );
    return Buffer.from(`﻿${lines.join("\r\n")}\r\n`, "utf8");
  }

  async toXlsx(report: SalesReport): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Ventas");
    sheet.addRow([title(report)]).font = { bold: true, size: 13 };
    sheet.addRow([]);
    const head = sheet.addRow(headers(report));
    head.font = { bold: true };
    head.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE5E7EB" },
    };

    const offset = isDishLevel(report) ? 1 : 0;
    for (const l of flatten(report)) {
      const row = sheet.addRow([
        l.period,
        l.label,
        ...(isDishLevel(report) ? [l.family] : []),
        l.amounts.units,
        l.amounts.invitedUnits,
        l.amounts.base,
        l.amounts.total,
        l.share === null ? null : Math.round(l.share * 100) / 10000,
      ]);
      if (l.kind !== "row") {
        row.font = { bold: true };
      }
    }
    sheet.getColumn(1).width = 26;
    sheet.getColumn(2).width = 42;
    if (offset) {
      sheet.getColumn(3).width = 36;
    }
    sheet.getColumn(3 + offset).numFmt = "#,##0.##";
    sheet.getColumn(4 + offset).numFmt = "#,##0.##";
    sheet.getColumn(5 + offset).numFmt = '#,##0.00 "€"';
    sheet.getColumn(6 + offset).numFmt = '#,##0.00 "€"';
    sheet.getColumn(7 + offset).numFmt = "0.0%";
    for (let c = 3 + offset; c <= 7 + offset; c++) {
      sheet.getColumn(c).width = 16;
    }
    sheet.views = [{ state: "frozen", ySplit: 3 }];
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  toPdf(report: SalesReport): Promise<Buffer> {
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

    doc.fontSize(14).font("Helvetica-Bold").text(title(report));
    doc.moveDown(0.5);

    const dish = isDishLevel(report);
    // Anchos de columna sobre 770 pt útiles en A4 apaisado.
    const widths = dish
      ? [110, 190, 150, 60, 60, 70, 70, 50]
      : [130, 290, 70, 70, 80, 80, 50];
    const left = doc.page.margins.left;
    const drawRow = (cells: string[], bold = false) => {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 20) {
        doc.addPage();
      }
      const y = doc.y;
      let x = left;
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8);
      cells.forEach((cell, i) => {
        doc.text(cell, x, y, {
          width: widths[i] - 4,
          align: i >= cells.length - 5 ? "right" : "left",
          lineBreak: false,
          ellipsis: true,
        });
        x += widths[i];
      });
      doc.x = left;
      doc.y = y + 13;
    };

    drawRow(headers(report), true);
    doc
      .moveTo(left, doc.y - 2)
      .lineTo(left + widths.reduce((a, b) => a + b, 0), doc.y - 2)
      .stroke("#999999");
    for (const l of flatten(report)) {
      drawRow(
        [
          l.period,
          l.label,
          ...(dish ? [l.family] : []),
          qty(l.amounts.units),
          qty(l.amounts.invitedUnits),
          euros(l.amounts.base),
          euros(l.amounts.total),
          l.share === null ? "" : `${qty(l.share)} %`,
        ],
        l.kind !== "row",
      );
    }
    if (report.missingAmounts > 0) {
      doc.moveDown();
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#a15c00")
        .text(
          `${report.missingAmounts} líneas de venta aún sin importe: cuentan unidades pero no euros hasta que el conector complete el histórico.`,
          left,
        )
        .fillColor("#000000");
    }
    doc.end();
    return done;
  }

  fileName(report: SalesReport, format: SalesReportFormat): string {
    const { from, to } = report.query;
    return `ventas-${from}${from === to ? "" : `_${to}`}.${format}`;
  }
}
