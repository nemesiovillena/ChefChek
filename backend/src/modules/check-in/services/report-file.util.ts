import { Response } from "express";
import { ReportFormat } from "../dto/report.dto";
import { IntegrityService } from "./integrity.service";
import { ReportExportService } from "./report-export.service";
import { ReportService } from "./report.service";

const CONTENT_TYPES: Record<ReportFormat, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv; charset=utf-8",
};

/**
 * Genera el registro de jornada de un mes en el formato pedido y lo envía
 * como descarga. Compartido por la ruta de gerencia y la del enlace de
 * inspección: mismo documento en ambos casos.
 */
export async function sendWorkdayReport(
  res: Response,
  deps: {
    reports: ReportService;
    exporter: ReportExportService;
    integrity: IntegrityService;
  },
  params: {
    tenantId: string;
    year: number;
    month: number;
    format: ReportFormat;
    employeeId?: string;
  },
) {
  const { tenantId, year, month, format, employeeId } = params;
  const reports = await deps.reports.buildMany(
    tenantId,
    year,
    month,
    employeeId,
  );
  let buffer: Buffer;
  if (format === "csv") {
    buffer = deps.exporter.toCsv(reports);
  } else if (format === "xlsx") {
    buffer = await deps.exporter.toXlsx(reports);
  } else {
    buffer = await deps.exporter.toPdf(
      reports,
      await deps.integrity.verify(tenantId),
    );
  }
  const name = `registro-jornada-${year}-${String(month).padStart(2, "0")}.${format}`;
  res.set({
    "Content-Type": CONTENT_TYPES[format],
    "Content-Disposition": `attachment; filename="${name}"`,
    "Cache-Control": "no-store",
  });
  res.send(buffer);
}
