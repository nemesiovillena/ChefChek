import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";
import {
  SictedAnnualReportService,
  SictedAnnualReport,
} from "./sicted-annual-report.service";

const A4_PORTRAIT: [number, number] = [595.28, 841.89];
const MARGIN = 40;

/**
 * PDF del informe anual (DIR.10, fase 9, sub-PR 4/4): mismo patrón PDFKit
 * que `sicted-mantenimiento-pdf.service.ts`/`sicted-plan-pdf.service.ts`
 * (fases 2/4/5) — una sección por bloque agregado.
 */
@Injectable()
export class SictedAnnualReportPdfService {
  constructor(private readonly aggregator: SictedAnnualReportService) {}

  async generate(tenantId: string, year: number): Promise<Buffer> {
    const report = await this.aggregator.aggregate(tenantId, year);

    const doc = new PDFDocument({ size: A4_PORTRAIT, margin: MARGIN });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));

    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .text(`Informe anual de calidad ${year}`);
    doc
      .moveDown(0.3)
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#666")
      .text(
        "Herramienta de apoyo interno — no sustituye la evaluación oficial de un evaluador externo SICTED.",
      )
      .fillColor("#000");

    this.section(doc, "Autoevaluación", () => {
      if (!report.assessment) {
        this.empty(doc, "Sin autoevaluación cerrada este año.");
        return;
      }
      this.line(
        doc,
        `${report.assessment.label} — cerrada el ${report.assessment.closedAt.slice(0, 10)} · ${report.assessment.pendingMandatoryCount} obligatorias pendientes o <3`,
      );
    });

    this.section(doc, "Objetivos", () => {
      if (report.objectives.length === 0) {
        return this.empty(doc, "Sin objetivos registrados este año.");
      }
      for (const o of report.objectives) {
        this.line(
          doc,
          `${o.title} — ${o.status}${o.indicator ? ` · ${o.indicator}` : ""}${o.target ? ` (meta: ${o.target})` : ""}${o.currentValue ? ` · actual: ${o.currentValue}` : ""}`,
        );
      }
    });

    this.section(doc, "Plan de mejora", () => {
      this.line(
        doc,
        `${report.improvementActions.openCount} acciones abiertas actualmente · ${report.improvementActions.closedThisYearCount} implantadas este año`,
      );
      for (const a of report.improvementActions.closedThisYear) {
        this.line(
          doc,
          `  #${a.code} ${a.title} — implantada ${a.closedAt.slice(0, 10)}`,
        );
      }
    });

    this.section(doc, "Participación (eventos)", () => {
      if (report.events.length === 0) {
        return this.empty(doc, "Sin eventos registrados este año.");
      }
      for (const e of report.events) {
        this.line(doc, `${e.kind}: ${e.count}`);
      }
    });

    this.section(doc, "Documentos legales vigentes", () => {
      if (report.legalDocs.length === 0) {
        return this.empty(doc, "Sin documentos legales activos.");
      }
      for (const d of report.legalDocs) {
        this.line(
          doc,
          `${d.label} — ${d.title}${d.expiresAt ? ` · caduca ${d.expiresAt.slice(0, 10)}` : ""}`,
        );
      }
    });

    this.section(doc, "Proveedores", () => {
      this.line(
        doc,
        `${report.supplierIncidents.count} incidencia(s) de recepción este año, ${report.supplierIncidents.resolvedCount} resuelta(s)`,
      );
    });

    this.section(doc, "Formación", () => {
      this.line(
        doc,
        `${report.training.plansCount} plan(es) de formación · ${report.training.actionsDone}/${report.training.actionsTotal} acciones hechas`,
      );
    });

    this.section(doc, "Cliente", () => {
      this.line(
        doc,
        `Quejas/sugerencias: ${report.feedback.total} recibidas, ${report.feedback.open} abiertas, ${report.feedback.overdue} vencidas`,
      );
      this.line(
        doc,
        `Satisfacción: ${report.satisfaction.samplesCount} muestra(s)${report.satisfaction.averageScore !== null ? ` · media ${report.satisfaction.averageScore.toFixed(1)}/5` : ""}`,
      );
    });

    doc
      .moveDown(1)
      .font("Helvetica")
      .fontSize(7)
      .fillColor("#666")
      .text(`Generado el ${new Date().toISOString()}`);

    doc.end();
    await new Promise((resolve) => doc.on("end", resolve));
    return Buffer.concat(chunks);
  }

  private section(doc: PDFKit.PDFDocument, title: string, body: () => void) {
    doc.moveDown(0.8).font("Helvetica-Bold").fontSize(12).text(title);
    doc.moveDown(0.2);
    body();
  }

  private line(doc: PDFKit.PDFDocument, text: string) {
    doc.font("Helvetica").fontSize(8).text(text);
  }

  private empty(doc: PDFKit.PDFDocument, text: string) {
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#666")
      .text(text)
      .fillColor("#000");
  }
}

export type { SictedAnnualReport };
