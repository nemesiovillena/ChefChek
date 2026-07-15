import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";
import { PrismaService } from "../../../common/services/prisma.service";
import { PurchaseOrderService } from "./purchase-order.service";

const euro = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});

/** PDF A4 del pedido de compra (patrón pdfkit de technical-sheets). */
@Injectable()
export class PurchaseOrderPdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly purchaseOrderService: PurchaseOrderService,
  ) {}

  async generate(tenantId: string, orderId: string): Promise<Buffer> {
    const order = await this.purchaseOrderService.findOne(tenantId, orderId);
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { name: true },
    });
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: order.supplierId, tenantId },
      select: {
        name: true,
        contactPerson: true,
        email: true,
        phone: true,
        address: true,
      },
    });

    const doc = new PDFDocument({
      size: [595.28, 841.89], // A4
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) =>
      doc.on("end", () => resolve(Buffer.concat(chunks))),
    );

    // ── Cabecera ──
    doc.fontSize(18).font("Helvetica-Bold").text(`Pedido ${order.orderNumber}`);
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#555555")
      .text(
        `${tenant?.name ?? ""} · ${new Date(order.createdAt).toLocaleDateString("es-ES")}` +
          (order.location?.name ? ` · Local: ${order.location.name}` : ""),
      );
    doc.moveDown();

    doc
      .fillColor("#000000")
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("Proveedor");
    doc.fontSize(10).font("Helvetica");
    doc.text(supplier?.name ?? "");
    if (supplier?.contactPerson) {
      doc.text(`Att.: ${supplier.contactPerson}`);
    }
    if (supplier?.address) {
      doc.text(supplier.address);
    }
    if (supplier?.phone) {
      doc.text(`Tel.: ${supplier.phone}`);
    }
    if (supplier?.email) {
      doc.text(supplier.email);
    }
    doc.moveDown();

    // ── Tabla de líneas ──
    const left = 50;
    const cols = { name: left, qty: 330, unit: 385, price: 460, total: 545 };
    const drawRow = (
      y: number,
      cells: {
        name: string;
        qty: string;
        unit: string;
        price: string;
        total: string;
      },
      bold = false,
    ) => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9);
      doc.text(cells.name, cols.name, y, { width: 270 });
      doc.text(cells.qty, cols.qty - 40, y, { width: 60, align: "right" });
      doc.text(cells.unit, cols.unit, y, { width: 60 });
      doc.text(cells.price, cols.price - 45, y, { width: 60, align: "right" });
      doc.text(cells.total, cols.total - 60, y, { width: 60, align: "right" });
    };

    let y = doc.y + 5;
    drawRow(
      y,
      {
        name: "Artículo",
        qty: "Cantidad",
        unit: "Unidad",
        price: "Precio",
        total: "Importe",
      },
      true,
    );
    y += 16;
    doc
      .moveTo(left, y - 4)
      .lineTo(545, y - 4)
      .strokeColor("#999999")
      .stroke();

    for (const line of order.lines ?? []) {
      if (y > 770) {
        doc.addPage();
        y = 50;
      }
      drawRow(y, {
        name: line.product?.name ?? line.productId,
        qty: String(line.quantity),
        unit: line.unit ?? "",
        price:
          line.expectedPrice !== null ? euro.format(line.expectedPrice) : "—",
        total:
          line.expectedPrice !== null
            ? euro.format(line.quantity * line.expectedPrice)
            : "—",
      });
      y += 16;
    }

    doc.moveTo(left, y).lineTo(545, y).strokeColor("#999999").stroke();
    y += 8;
    drawRow(
      y,
      {
        name: "",
        qty: "",
        unit: "",
        price: "Total est.",
        total: euro.format(order.expectedTotal),
      },
      true,
    );

    if (order.notes) {
      doc.moveDown(2);
      doc.font("Helvetica-Oblique").fontSize(9).fillColor("#555555");
      doc.text(order.notes, left, y + 30, { width: 495 });
    }

    doc.end();
    return done;
  }
}
