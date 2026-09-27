import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import PDFDocument from "pdfkit";
import { PrismaService } from "../../../common/services/prisma.service";

const A4_PORTRAIT: [number, number] = [595.28, 841.89];
const MARGIN = 40;

/** Calendario anual de revisiones + libro de averías/PAC del año — un único PDF para el auditor. */
@Injectable()
export class SictedMantenimientoPdfService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(tenantId: string, year: number): Promise<Buffer> {
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

    const records = await this.prisma.checklistMaintenanceRecord.findMany({
      where: { tenantId, performedAt: { gte: yearStart, lt: yearEnd } },
      include: {
        plan: { select: { title: true } },
        asset: { select: { name: true, usedByModules: true } },
      },
      orderBy: { performedAt: "asc" },
    });
    const sictedRecords = records.filter((r) =>
      r.asset.usedByModules.includes("sicted"),
    );

    const incidents = await this.prisma.checklistIncident.findMany({
      where: {
        tenantId,
        usedByModules: { has: "sicted" },
        detectedAt: { gte: yearStart, lt: yearEnd },
      },
      include: { asset: { select: { name: true } } },
      orderBy: { detectedAt: "asc" },
    });

    const doc = new PDFDocument({ size: A4_PORTRAIT, margin: MARGIN });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));

    doc.font("Helvetica-Bold").fontSize(16).text(`Mantenimiento ${year}`);
    doc
      .moveDown(0.5)
      .font("Helvetica-Bold")
      .fontSize(12)
      .text("Revisiones realizadas");
    doc.moveDown(0.2);
    for (const r of sictedRecords) {
      doc
        .font("Helvetica")
        .fontSize(8)
        .text(
          `${r.performedAt.toISOString().slice(0, 10)} — ${r.plan.title} (${r.asset.name}) · ${r.performedByName}${r.providerName ? ` · ${r.providerName}` : ""}`,
        );
    }
    if (sictedRecords.length === 0) {
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#666")
        .text("Sin revisiones registradas en este periodo.")
        .fillColor("#000");
    }

    doc
      .moveDown(0.8)
      .font("Helvetica-Bold")
      .fontSize(12)
      .text("Averías y acciones correctivas");
    doc.moveDown(0.2);
    for (const inc of incidents) {
      const label =
        inc.kind === "CORRECTIVE_ACTION" && inc.partNumber
          ? `Parte Nº ${inc.partNumber}`
          : "Parte de avería";
      doc
        .font("Helvetica")
        .fontSize(8)
        .text(
          `${inc.detectedAt.toISOString().slice(0, 10)} — ${label} (${inc.asset?.name ?? "sin equipo"}) · ${inc.status}${inc.resolvedAt ? ` · resuelta ${inc.resolvedAt.toISOString().slice(0, 10)}` : ""}`,
        );
    }
    if (incidents.length === 0) {
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#666")
        .text("Sin incidencias registradas en este periodo.")
        .fillColor("#000");
    }

    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          year,
          records: sictedRecords.map((r) => r.id),
          incidents: incidents.map((i) => i.id),
        }),
      )
      .digest("hex");
    doc.moveDown(1);
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor("#666")
      .text(
        `Generado el ${new Date().toISOString()} · ${sictedRecords.length} revisión(es), ${incidents.length} incidencia(s) · Huella SHA-256: ${fingerprint}`,
      );

    doc.end();
    await new Promise((resolve) => doc.on("end", resolve));
    return Buffer.concat(chunks);
  }
}
