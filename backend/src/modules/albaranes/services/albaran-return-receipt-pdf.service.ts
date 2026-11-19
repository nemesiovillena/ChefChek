import { Injectable, NotFoundException } from "@nestjs/common";
import PDFDocument from "pdfkit";
import { PrismaService } from "../../../common/services/prisma.service";

const A4_PORTRAIT: [number, number] = [595.28, 841.89];
const MARGIN = 50;
const TZ = "Europe/Madrid";

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("es-ES", { timeZone: TZ, dateStyle: "short" }).format(
    d,
  );
const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat("es-ES", {
    timeZone: TZ,
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
const fmtNumber = (n: number) =>
  String(Math.round(n * 1000) / 1000).replace(".", ",");
const fmtEuro = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(
    n,
  );

/**
 * Justificante de una devolución al proveedor: constancia en papel de qué se
 * devolvió, cuándo, por qué y quién lo registró, con hueco para la firma del
 * repartidor. Sirve tanto antes como después de que oficina la aplique.
 */
@Injectable()
export class AlbaranReturnReceiptPdfService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(
    tenantId: string,
    albaranId: string,
    returnId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const ret = await this.prisma.albaranReturn.findFirst({
      where: { id: returnId, albaranId, tenantId },
      include: {
        albaran: { include: { supplier: true } },
        line: true,
        appliedLine: true,
      },
    });
    if (!ret) {
      throw new NotFoundException("Devolución no encontrada");
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    const albaranLabel =
      ret.albaran.albaranNumber || ret.albaran.internalNumber;
    const quantity =
      ret.quantity !== null
        ? `${fmtNumber(ret.quantity)}${ret.unit ? ` ${ret.unit}` : ""}`
        : "—";
    const article = ret.line ? ret.line.description : ret.description;

    let amount = "Pendiente de aplicar en oficina";
    if (ret.status === "DESCARTADA") {
      amount = `Descartada: ${ret.discardNote ?? ""}`;
    } else if (ret.settlement === "CREDIT_NOTE") {
      amount = ret.creditNoteSettledAt
        ? "Abonado en abono aparte"
        : "Pendiente de abono aparte";
    } else if (ret.settlement === "IN_ALBARAN" && ret.appliedLine) {
      const net = Math.abs(
        Number(ret.appliedLine.totalPrice ?? ret.appliedLine.lineAmount),
      );
      amount = `${fmtEuro(net)} + IVA, descontado en este albarán`;
    }

    const rows: [string, string][] = [
      ["Proveedor", ret.albaran.supplier?.name ?? "—"],
      ["Albarán", `${albaranLabel} · ${fmtDate(ret.albaran.date)}`],
      ["Fecha devolución", fmtDateTime(ret.reportedAt)],
      ["Artículo", article],
      ...(ret.line && ret.description !== ret.line.description
        ? ([["Anotado como", ret.description]] as [string, string][])
        : []),
      ["Cantidad", quantity],
      ["Importe", amount],
      ["Motivo", ret.reason],
      ["Registrado por", ret.reportedByName],
    ];

    const doc = new PDFDocument({ size: A4_PORTRAIT, margin: MARGIN });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    const done = new Promise<void>((resolve) => doc.on("end", () => resolve()));

    if (tenant?.name) {
      doc.font("Helvetica").fontSize(10).fillColor("#555").text(tenant.name);
      doc.moveDown(0.3);
    }
    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor("#000")
      .text("JUSTIFICANTE DE DEVOLUCIÓN");
    doc.moveDown(1.2);

    const labelWidth = 130;
    for (const [label, value] of rows) {
      const y = doc.y;
      doc
        .font("Helvetica")
        .fontSize(11)
        .fillColor("#555")
        .text(label, MARGIN, y, {
          width: labelWidth,
        });
      doc
        .font("Helvetica-Bold")
        .fillColor("#000")
        .text(value, MARGIN + labelWidth, y, {
          width: A4_PORTRAIT[0] - MARGIN * 2 - labelWidth,
        });
      doc.moveDown(0.6);
    }

    doc.moveDown(4);
    const signY = doc.y;
    const colWidth = (A4_PORTRAIT[0] - MARGIN * 2 - 40) / 2;
    for (const [i, label] of [
      "Firma restaurante",
      "Firma repartidor",
    ].entries()) {
      const x = MARGIN + i * (colWidth + 40);
      doc
        .moveTo(x, signY)
        .lineTo(x + colWidth, signY)
        .strokeColor("#888")
        .stroke();
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#555")
        .text(label, x, signY + 4, {
          width: colWidth,
        });
    }

    doc.end();
    await done;
    const safe = albaranLabel.replace(/[^A-Za-z0-9-]+/g, "_");
    return {
      buffer: Buffer.concat(chunks),
      filename: `devolucion-${safe}.pdf`,
    };
  }
}
