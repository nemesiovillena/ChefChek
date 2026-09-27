import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import PDFDocument from "pdfkit";
import { PrismaService } from "../../../common/services/prisma.service";

const A4_PORTRAIT: [number, number] = [595.28, 841.89];
const MARGIN = 40;

/**
 * El Plan (manual): qué se limpia/revisa, frecuencia, productos/dosis/EPI,
 * procedimiento, responsable — por área o todas. Documento vivo: usa la
 * plantilla vigente (no un snapshot), a diferencia de "Registros" (evidencia
 * histórica de una hoja concreta).
 */
@Injectable()
export class SictedPlanPdfService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(tenantId: string, area?: string): Promise<Buffer> {
    const templates = await this.prisma.checklistTemplate.findMany({
      where: {
        tenantId,
        usedByModules: { has: "sicted" },
        archivedAt: null,
        ...(area ? { area } : {}),
      },
      include: { items: { orderBy: { position: "asc" } } },
      orderBy: [{ area: "asc" }, { name: "asc" }],
    });

    const doc = new PDFDocument({ size: A4_PORTRAIT, margin: MARGIN });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));

    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .text(
        area
          ? `Plan de limpieza y revisión — ${area}`
          : "Plan de limpieza y revisión",
      );
    doc.moveDown(0.5);

    let currentArea = "";
    for (const template of templates) {
      if (template.area !== currentArea) {
        currentArea = template.area;
        doc.moveDown(0.5).font("Helvetica-Bold").fontSize(12).text(currentArea);
        doc.moveDown(0.2);
      }
      this.renderTemplate(doc, template);
    }

    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify(
          templates.map((t) => ({
            id: t.id,
            version: t.version,
            name: t.name,
          })),
        ),
      )
      .digest("hex");
    doc.moveDown(1);
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor("#666")
      .text(
        `Generado el ${new Date().toISOString()} · ${templates.length} plantilla(s) · Huella SHA-256: ${fingerprint}`,
      );

    doc.end();
    await new Promise((resolve) => doc.on("end", resolve));
    return Buffer.concat(chunks);
  }

  private renderTemplate(
    doc: PDFKit.PDFDocument,
    template: {
      name: string;
      frequency: string;
      responsiblePosition: string | null;
      items: {
        label: string;
        procedure: string | null;
        products: string[];
        dosage: string | null;
        epi: string | null;
      }[];
    },
  ): void {
    doc.font("Helvetica-Bold").fontSize(10).text(template.name);
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#444")
      .text(
        `Frecuencia: ${template.frequency}${template.responsiblePosition ? ` · Responsable: ${template.responsiblePosition}` : ""}`,
      );
    doc.fillColor("#000");
    for (const item of template.items) {
      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .text(`• ${item.label}`, { indent: 10 });
      const details: string[] = [];
      if (item.procedure) {
        details.push(`Procedimiento: ${item.procedure}`);
      }
      if (item.products.length) {
        details.push(`Productos: ${item.products.join(", ")}`);
      }
      if (item.dosage) {
        details.push(`Dosis: ${item.dosage}`);
      }
      if (item.epi) {
        details.push(`EPI: ${item.epi}`);
      }
      if (details.length) {
        doc
          .font("Helvetica")
          .fontSize(7.5)
          .fillColor("#333")
          .text(details.join("  ·  "), { indent: 14 });
        doc.fillColor("#000");
      }
    }
    doc.moveDown(0.4);
  }
}
