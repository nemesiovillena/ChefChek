import { Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import PDFDocument from "pdfkit";
import { PrismaService } from "../../../common/services/prisma.service";
import {
  periodEndFromKey,
  periodStartFromKey,
  ChecklistFrequency,
} from "../../checklists/util/checklist-period.util";

const A4_LANDSCAPE: [number, number] = [841.89, 595.28];
const MARGIN = 28;

/**
 * Cuadrante mensual (el documento de mayor valor para un auditor): filas =
 * ítems, columnas = periodos del mes, celda = ✓/✗/vacío + iniciales, columna
 * de observaciones, fila de validación del supervisor. Determinista: el
 * mismo dato produce siempre el mismo PDF y la misma huella SHA-256 (hash de
 * los datos incluidos, no del PDF en sí — pdfkit no es byte-a-byte estable
 * entre ejecuciones por timestamps internos).
 */
@Injectable()
export class SictedRegistrosPdfService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(
    tenantId: string,
    templateId: string,
    monthKey: string,
  ): Promise<Buffer> {
    const template = await this.prisma.checklistTemplate.findFirst({
      where: { id: templateId, tenantId, usedByModules: { has: "sicted" } },
    });
    if (!template) {
      throw new NotFoundException("Plantilla no encontrada");
    }

    const monthStart = periodStartFromKey(monthKey, "MONTHLY");
    const monthEnd = periodEndFromKey(monthKey, "MONTHLY");
    const runs = await this.prisma.checklistRun.findMany({
      where: {
        tenantId,
        templateId,
        periodStart: { gte: monthStart, lt: monthEnd },
      },
      include: { entries: { orderBy: { recordedAt: "asc" } } },
      orderBy: { periodKey: "asc" },
    });

    const items = await this.prisma.checklistTemplateItem.findMany({
      where: { templateId },
      orderBy: { position: "asc" },
    });

    const fingerprint = this.fingerprint(template.name, monthKey, runs, items);
    const doc = new PDFDocument({ size: A4_LANDSCAPE, margin: MARGIN });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));

    this.renderHeader(doc, template.name, template.area, monthKey);
    this.renderGrid(doc, items, runs, template.frequency as ChecklistFrequency);
    this.renderFooter(doc, runs.length, fingerprint);

    doc.end();
    await new Promise((resolve) => doc.on("end", resolve));
    return Buffer.concat(chunks);
  }

  private renderHeader(
    doc: PDFKit.PDFDocument,
    name: string,
    area: string,
    monthKey: string,
  ): void {
    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .text(`Registro de limpieza/revisión — ${name}`, { align: "left" });
    doc
      .font("Helvetica")
      .fontSize(9)
      .text(`Área: ${area}  ·  Periodo: ${monthKey}`);
    doc.moveDown(0.5);
  }

  private renderGrid(
    doc: PDFKit.PDFDocument,
    items: { id: string; label: string }[],
    runs: Array<{
      periodKey: string;
      supervisedAt: Date | null;
      supervisorName: string | null;
      entries: Array<{
        itemId: string;
        outcome: string | null;
        value: number | null;
        reason: string | null;
        observation: string | null;
        performedByName: string;
        recordedAt: Date;
      }>;
    }>,
    frequency: ChecklistFrequency,
  ): void {
    const labelColW = 130;
    const obsColW = 90;
    const dayColW = Math.min(
      20,
      (A4_LANDSCAPE[0] - 2 * MARGIN - labelColW - obsColW) /
        Math.max(runs.length, 1),
    );
    const rowH = 16;
    let y = doc.y + 4;
    const startX = MARGIN;

    doc.font("Helvetica-Bold").fontSize(7);
    doc.text("Elemento", startX, y, { width: labelColW });
    runs.forEach((run, i) => {
      const dayLabel =
        frequency === "DAILY"
          ? run.periodKey.slice(-2)
          : run.periodKey.slice(-3);
      doc.text(dayLabel, startX + labelColW + i * dayColW, y, {
        width: dayColW,
        align: "center",
      });
    });
    doc.text("Observaciones", startX + labelColW + runs.length * dayColW, y, {
      width: obsColW,
    });
    y += rowH;
    doc
      .moveTo(startX, y - 2)
      .lineTo(startX + labelColW + runs.length * dayColW + obsColW, y - 2)
      .stroke();

    for (const item of items) {
      doc.font("Helvetica").fontSize(6.5);
      doc.text(item.label, startX, y, {
        width: labelColW,
        height: rowH,
        ellipsis: true,
      });
      const observations: string[] = [];
      runs.forEach((run, i) => {
        const entry = this.currentEntry(run.entries, item.id);
        const cellX = startX + labelColW + i * dayColW;
        if (entry) {
          const ok = entry.outcome === "DONE" || entry.outcome === "OK";
          // "OK"/"NO" en vez de ✓/✗: la fuente Helvetica estándar (WinAnsi) no
          // tiene esos glifos — salían como carácter roto en el PDF impreso.
          const mark =
            entry.value !== null ? String(entry.value) : ok ? "OK" : "NO";
          doc.text(mark, cellX, y, { width: dayColW, align: "center" });
          const note = entry.reason || entry.observation;
          if (note) {
            observations.push(`${run.periodKey}: ${note}`);
          }
        } else {
          doc.text("—", cellX, y, { width: dayColW, align: "center" });
        }
      });
      doc
        .fontSize(5.5)
        .text(
          observations.join("; ") || "",
          startX + labelColW + runs.length * dayColW,
          y,
          {
            width: obsColW,
            height: rowH,
            ellipsis: true,
          },
        );
      y += rowH;
      if (y > A4_LANDSCAPE[1] - MARGIN - 40) {
        doc.addPage({ size: A4_LANDSCAPE, margin: MARGIN });
        y = MARGIN;
      }
    }

    y += 6;
    doc
      .font("Helvetica-Bold")
      .fontSize(6.5)
      .text("Validado por (supervisor)", startX, y, { width: labelColW });
    runs.forEach((run, i) => {
      const initials = run.supervisorName
        ? this.initials(run.supervisorName)
        : run.supervisedAt
          ? "—"
          : "";
      doc.text(initials, startX + labelColW + i * dayColW, y, {
        width: dayColW,
        align: "center",
      });
    });
    doc.y = y + rowH + 4;
    doc
      .font("Helvetica")
      .fontSize(6)
      .text(
        "Leyenda: OK hecho/bien · NO no realizado/mal · — sin marcar · número = medición",
      );
  }

  private renderFooter(
    doc: PDFKit.PDFDocument,
    recordCount: number,
    fingerprint: string,
  ): void {
    doc.moveDown(1);
    doc
      .font("Helvetica")
      .fontSize(6)
      .fillColor("#666")
      .text(
        `Generado el ${new Date().toISOString()} · ${recordCount} hoja(s) incluida(s) · Huella SHA-256: ${fingerprint}`,
      );
    doc.fillColor("#000");
  }

  private currentEntry<T extends { itemId: string; recordedAt: Date }>(
    entries: T[],
    itemId: string,
  ): T | undefined {
    let current: T | undefined;
    for (const e of entries) {
      if (e.itemId !== itemId) {
        continue;
      }
      if (!current || e.recordedAt >= current.recordedAt) {
        current = e;
      }
    }
    return current;
  }

  private initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0]?.toUpperCase())
      .join("")
      .slice(0, 3);
  }

  /** Huella determinista de los datos incluidos — no del PDF (pdfkit no es byte-estable). */
  private fingerprint(
    templateName: string,
    monthKey: string,
    runs: Array<{
      periodKey: string;
      supervisorName: string | null;
      entries: Array<{
        id: string;
        itemId: string;
        outcome: string | null;
        value: number | null;
        recordedAt: Date;
      }>;
    }>,
    items: { id: string; label: string }[],
  ): string {
    const canonical = JSON.stringify({
      templateName,
      monthKey,
      items: items.map((i) => ({ id: i.id, label: i.label })),
      runs: runs.map((r) => ({
        periodKey: r.periodKey,
        supervisorName: r.supervisorName,
        entries: r.entries.map((e) => ({
          id: e.id,
          itemId: e.itemId,
          outcome: e.outcome,
          value: e.value,
        })),
      })),
    });
    return createHash("sha256").update(canonical).digest("hex");
  }
}
