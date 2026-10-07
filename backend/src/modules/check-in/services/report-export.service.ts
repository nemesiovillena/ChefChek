import { Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { IntegrityResult } from "./integrity.service";
import { WorkdayReport } from "./report.service";

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
const PUNCH_LABELS: Record<string, string> = {
  IN: "Entrada",
  OUT: "Salida",
  BREAK_START: "Inicio de pausa",
  BREAK_END: "Fin de pausa",
};
const INCIDENCE_LABELS: Record<string, string> = {
  SIN_SALIDA: "Falta fichar la salida",
  SECUENCIA: "Fichajes que no encajan",
};
const KIND_LABELS: Record<string, string> = {
  ADD: "Fichaje añadido",
  VOID: "Fichaje anulado",
  REPLACE: "Fichaje sustituido",
  CONFIRM: "Fichaje dado por bueno",
};

const time = (instant: Date, timezone: string) =>
  new Intl.DateTimeFormat("es-ES", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(instant);
const dateTime = (instant: Date, timezone: string) =>
  new Intl.DateTimeFormat("es-ES", {
    timeZone: timezone,
    dateStyle: "short",
    timeStyle: "short",
  }).format(instant);
/** "2026-10-05" -> "05/10/2026" */
const dayLabel = (date: string) => date.split("-").reverse().join("/");
/** 510 -> "8:30" */
const hhmm = (minutes: number) =>
  `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;

type ReportDay = WorkdayReport["days"][number];

const workSegments = (day: ReportDay, timezone: string) =>
  day.segments
    .filter((segment) => segment.kind === "WORK")
    .map(
      (segment) =>
        `${time(segment.start, timezone)}-${time(segment.end, timezone)}`,
    )
    .join("  ");

const dayNotes = (day: ReportDay) =>
  [
    ...day.incidences.map((code) => INCIDENCE_LABELS[code] ?? code),
    day.open ? "Jornada en curso" : "",
    day.punches.some((p) => p.origin === "ADJUSTMENT" || p.voided)
      ? "Con correcciones"
      : "",
  ]
    .filter(Boolean)
    .join("; ");

const COLUMNS = [
  "Empresa",
  "CIF",
  "Centro",
  "Empleado",
  "DNI/NIE",
  "N.º Seguridad Social",
  "Fecha",
  "Tramos (entrada-salida)",
  "Horas trabajadas",
  "Pausas",
  "Observaciones",
];

function rows(report: WorkdayReport): (string | number)[][] {
  return report.days.map((day) => [
    report.company.name,
    report.company.taxId ?? "",
    report.center ?? "",
    report.employee.name,
    report.employee.nationalId ?? "",
    report.employee.socialSecurityNumber ?? "",
    dayLabel(day.date),
    workSegments(day, report.timezone),
    hhmm(day.workedMinutes),
    hhmm(day.breakMinutes),
    dayNotes(day),
  ]);
}

/**
 * Exportadores del registro de jornada. Todos parten de WorkdayReport; no
 * calculan nada. Formatos: PDF (para entregar o firmar), Excel y CSV (para
 * tratar los datos).
 */
@Injectable()
export class ReportExportService {
  /** CSV con separador ";" y BOM: se abre bien en Excel en español. */
  toCsv(reports: WorkdayReport[]): Buffer {
    const escape = (value: string | number) => {
      // Un texto que empieza por =, +, - o @ lo ejecutaría Excel como fórmula.
      const text =
        typeof value === "string" && /^[=+\-@\t\r]/.test(value)
          ? `'${value}`
          : String(value);
      return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const lines = [COLUMNS, ...reports.flatMap(rows)].map((row) =>
      row.map(escape).join(";"),
    );
    return Buffer.from(`﻿${lines.join("\r\n")}\r\n`, "utf8");
  }

  async toXlsx(reports: WorkdayReport[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.created = new Date();

    const daily = workbook.addWorksheet("Registro diario");
    daily.addRow(COLUMNS).font = { bold: true };
    reports.flatMap(rows).forEach((row) => daily.addRow(row));
    daily.columns.forEach((column, index) => {
      column.width = [28, 14, 20, 28, 14, 20, 12, 34, 16, 10, 40][index];
    });
    daily.views = [{ state: "frozen", ySplit: 1 }];

    const summary = workbook.addWorksheet("Resumen");
    summary.addRow([
      "Empleado",
      "DNI/NIE",
      "Mes",
      "Días trabajados",
      "Horas trabajadas",
      "Horas pactadas del mes",
      "Exceso estimado",
      "Días con incidencia",
      "Hoja aprobada",
      "Conformidad del empleado",
    ]).font = { bold: true };
    for (const report of reports) {
      summary.addRow([
        report.employee.name,
        report.employee.nationalId ?? "",
        `${MONTHS[report.month - 1]} ${report.year}`,
        report.totals.daysWorked,
        hhmm(report.totals.workedMinutes),
        hhmm(report.totals.expectedMinutes),
        hhmm(report.totals.overtimeMinutes),
        report.totals.incidenceCount,
        report.approval
          ? `v${report.approval.version} · ${report.approval.approvedByName}`
          : "No",
        report.approval?.acknowledgedAt
          ? dateTime(report.approval.acknowledgedAt, report.timezone)
          : "No",
      ]);
    }
    summary.columns.forEach((column) => (column.width = 22));

    const corrections = workbook.addWorksheet("Correcciones");
    corrections.addRow([
      "Empleado",
      "Corrección",
      "Fichaje",
      "Motivo",
      "Solicitada por",
      "Fecha de solicitud",
      "Decisión",
      "Decidida por",
      "Nota",
    ]).font = { bold: true };
    for (const report of reports) {
      for (const c of report.corrections) {
        corrections.addRow([
          report.employee.name,
          KIND_LABELS[c.kind] ?? c.kind,
          c.type && c.occurredAt
            ? `${PUNCH_LABELS[c.type]} ${dateTime(c.occurredAt, report.timezone)}`
            : "",
          c.reason,
          c.requestedByName,
          dateTime(c.createdAt, report.timezone),
          c.decision
            ? c.decision.status === "APPROVED"
              ? "Aprobada"
              : "Rechazada"
            : "Pendiente",
          c.decision?.decidedByName ?? "",
          c.decision?.note ?? "",
        ]);
      }
    }
    corrections.columns.forEach((column) => (column.width = 24));

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /** Un PDF con el registro de cada persona, empezando cada una en página nueva. */
  toPdf(reports: WorkdayReport[], integrity: IntegrityResult): Promise<Buffer> {
    const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) =>
      doc.on("end", () => resolve(Buffer.concat(chunks))),
    );

    if (reports.length === 0) {
      doc.fontSize(12).text("No hay fichajes en el periodo solicitado.");
    }
    reports.forEach((report, index) => {
      if (index > 0) {
        doc.addPage();
      }
      this.renderReport(doc, report);
    });

    // Pie en todas las páginas: huella de integridad y numeración.
    const range = doc.bufferedPageRange();
    const generated = new Intl.DateTimeFormat("es-ES", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: reports[0]?.timezone ?? "Europe/Madrid",
    }).format(new Date());
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      // El pie va por debajo del margen inferior: sin anularlo, pdfkit lo
      // consideraría desbordamiento y añadiría una página en blanco.
      doc.page.margins.bottom = 0;
      const footer = [
        `Generado el ${generated}`,
        integrity.ok
          ? `Registro íntegro (${integrity.checked} fichajes). Huella: ${(integrity.lastHash ?? "-").slice(0, 16)}`
          : `ATENCIÓN: la verificación de integridad falla en el fichaje n.º ${integrity.brokenAtSeq}`,
        `Página ${i + 1} de ${range.count}`,
      ].join("   ·   ");
      doc
        .fontSize(7)
        .fillColor("#555555")
        .text(footer, 40, doc.page.height - 32, {
          width: doc.page.width - 80,
          align: "center",
          lineBreak: false,
        })
        .fillColor("#000000");
    }
    doc.end();
    return done;
  }

  private renderReport(doc: PDFKit.PDFDocument, report: WorkdayReport) {
    const left = 40;
    const width = doc.page.width - 80;
    const bottom = doc.page.height - 50;
    const ensure = (height: number) => {
      if (doc.y + height > bottom) {
        doc.addPage();
      }
    };

    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("Registro diario de jornada", left, 40);
    doc
      .fontSize(9)
      .font("Helvetica")
      .text(
        `${MONTHS[report.month - 1]} de ${report.year} · Art. 34.9 del Estatuto de los Trabajadores`,
      );
    doc.moveDown(0.6);

    const field = (label: string, value: string | null) =>
      doc
        .font("Helvetica-Bold")
        .text(`${label}: `, { continued: true })
        .font("Helvetica")
        .text(value || "—");
    field(
      "Empresa",
      [
        report.company.name,
        report.company.taxId && `CIF ${report.company.taxId}`,
      ]
        .filter(Boolean)
        .join(" · "),
    );
    field(
      "Centro de trabajo",
      [report.center, report.company.address].filter(Boolean).join(" · "),
    );
    field(
      "Persona trabajadora",
      [
        report.employee.name,
        report.employee.nationalId && `DNI/NIE ${report.employee.nationalId}`,
        report.employee.socialSecurityNumber &&
          `N.º SS ${report.employee.socialSecurityNumber}`,
      ]
        .filter(Boolean)
        .join(" · "),
    );
    field(
      "Puesto y jornada pactada",
      [report.employee.jobTitle, `${report.employee.weeklyHours} h semanales`]
        .filter(Boolean)
        .join(" · "),
    );
    doc.moveDown(0.6);

    // Tabla de días
    const cols = [
      { title: "Día", width: 62 },
      { title: "Entradas y salidas", width: 190 },
      { title: "Pausas", width: 45 },
      { title: "Total", width: 45 },
      { title: "Observaciones", width: width - 342 },
    ];
    const drawRow = (cells: string[], bold = false) => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8.5);
      const heights = cells.map((cell, i) =>
        doc.heightOfString(cell, { width: cols[i].width - 6 }),
      );
      const rowHeight = Math.max(...heights) + 6;
      ensure(rowHeight);
      const y = doc.y;
      let x = left;
      cells.forEach((cell, i) => {
        doc.text(cell, x + 3, y + 3, { width: cols[i].width - 6 });
        x += cols[i].width;
      });
      doc
        .moveTo(left, y + rowHeight)
        .lineTo(left + width, y + rowHeight)
        .lineWidth(0.3)
        .strokeColor("#999999")
        .stroke();
      doc.x = left;
      doc.y = y + rowHeight;
    };
    drawRow(
      cols.map((c) => c.title),
      true,
    );
    for (const day of report.days) {
      drawRow([
        dayLabel(day.date),
        workSegments(day, report.timezone) || "—",
        day.breakMinutes > 0 ? hhmm(day.breakMinutes) : "",
        day.open ? "en curso" : hhmm(day.workedMinutes),
        dayNotes(day),
      ]);
    }
    if (report.days.length === 0) {
      drawRow(["", "Sin fichajes este mes", "", "", ""]);
    }

    doc.moveDown(0.8).fontSize(9);
    ensure(60);
    field("Días trabajados", String(report.totals.daysWorked));
    field("Total de horas trabajadas", hhmm(report.totals.workedMinutes));
    field(
      "Horas pactadas del mes / exceso estimado",
      `${hhmm(report.totals.expectedMinutes)} / ${hhmm(report.totals.overtimeMinutes)}`,
    );
    if (report.totals.incidenceCount > 0) {
      field(
        "Días con incidencia sin resolver",
        String(report.totals.incidenceCount),
      );
    }

    if (report.corrections.length > 0) {
      doc.moveDown(0.6);
      ensure(40);
      doc.font("Helvetica-Bold").text("Correcciones del mes");
      doc.font("Helvetica").fontSize(8);
      for (const c of report.corrections) {
        const what =
          c.type && c.occurredAt
            ? ` (${PUNCH_LABELS[c.type]} ${dateTime(c.occurredAt, report.timezone)})`
            : "";
        const decision = c.decision
          ? `${c.decision.status === "APPROVED" ? "Aprobada" : "Rechazada"} por ${c.decision.decidedByName} el ${dateTime(c.decision.decidedAt, report.timezone)}${c.decision.note ? `. ${c.decision.note}` : ""}`
          : "Pendiente de decisión";
        const line = `• ${KIND_LABELS[c.kind] ?? c.kind}${what}. Motivo: ${c.reason}. Solicitada por ${c.requestedByName} el ${dateTime(c.createdAt, report.timezone)}. ${decision}.`;
        ensure(doc.heightOfString(line, { width }) + 2);
        doc.text(line, left, doc.y, { width });
      }
      doc.fontSize(9);
    }

    doc.moveDown(0.8);
    ensure(90);
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .text(
        report.approval
          ? `Hoja aprobada (versión ${report.approval.version}) por ${report.approval.approvedByName} el ${dateTime(report.approval.approvedAt, report.timezone)}. ` +
              (report.approval.acknowledgedAt
                ? `Conformidad de la persona trabajadora registrada el ${dateTime(report.approval.acknowledgedAt, report.timezone)}.`
                : "Sin conformidad registrada de la persona trabajadora.")
          : "Mes sin aprobar: los datos pueden cambiar si se registran correcciones.",
        left,
        doc.y,
        { width },
      );
    doc.moveDown(2.5);
    const y = doc.y;
    doc.fontSize(8.5);
    doc.text("Firma de la empresa", left, y, { width: width / 2 - 10 });
    doc.text("Firma de la persona trabajadora", left + width / 2 + 10, y, {
      width: width / 2 - 10,
    });
    doc
      .moveTo(left, y - 6)
      .lineTo(left + width / 2 - 20, y - 6)
      .moveTo(left + width / 2 + 10, y - 6)
      .lineTo(left + width - 10, y - 6)
      .lineWidth(0.5)
      .strokeColor("#000000")
      .stroke();
  }
}
