import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PurchaseOrderStatus } from "@prisma/client";
import { PrismaService } from "../../../common/services/prisma.service";
import { MailService } from "../../mail/mail.service";
import { PurchaseOrderPdfService } from "./purchase-order-pdf.service";

export type SendChannel = "EMAIL" | "WHATSAPP" | "PHONE" | "WEB";
const SEND_CHANNELS: SendChannel[] = ["EMAIL", "WHATSAPP", "PHONE", "WEB"];

/** Estados desde los que se puede enviar un pedido al proveedor. */
const SENDABLE: PurchaseOrderStatus[] = [
  PurchaseOrderStatus.BORRADOR,
  PurchaseOrderStatus.PENDIENTE_ENVIO,
];

const ORDER_WITH_SUPPLIER = {
  supplier: true,
  location: { select: { name: true } },
  lines: {
    orderBy: { sortOrder: "asc" as const },
    include: { product: { select: { name: true } } },
  },
};

/**
 * Envío del pedido por el canal del proveedor (decisión de producto:
 * wa.me deep-link + SMTP propio + tel: manual; sin API WhatsApp Business).
 * EMAIL envía de verdad (SMTP del tenant, PDF adjunto). WHATSAPP/PHONE/WEB
 * registran el envío tras la confirmación manual del usuario.
 */
@Injectable()
export class OrderSendingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly pdfService: PurchaseOrderPdfService,
  ) {}

  /** Vista previa: texto del pedido, canales disponibles y enlaces. */
  async getSendPreview(tenantId: string, orderId: string) {
    const order = await this.findSendableOrder(tenantId, orderId, false);
    const text = this.buildMessage(order);
    const whatsappNumber = this.normalizePhone(order.supplier.whatsapp);

    return {
      orderNumber: order.orderNumber,
      status: order.status,
      channels: (order.supplier.orderMethods ?? []).filter(
        (m): m is SendChannel => SEND_CHANNELS.includes(m as SendChannel),
      ),
      text,
      email: order.supplier.email || null,
      phone: order.supplier.phone || null,
      whatsappUrl: whatsappNumber
        ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`
        : null,
    };
  }

  /**
   * Envía (EMAIL) o registra el envío (WHATSAPP/PHONE/WEB) y transiciona a
   * ENVIADO con sentVia/sentAt/sentBy + evento SENT.
   */
  async send(
    tenantId: string,
    orderId: string,
    userId: string | undefined,
    channel: SendChannel,
  ) {
    const order = await this.findSendableOrder(tenantId, orderId, true);

    if (!(order.supplier.orderMethods ?? []).includes(channel)) {
      throw new BadRequestException(
        `El proveedor no admite el canal ${channel}. Canales: ${order.supplier.orderMethods?.join(", ") || "ninguno"}.`,
      );
    }

    if (channel === "EMAIL") {
      if (!order.supplier.email) {
        throw new BadRequestException("El proveedor no tiene email.");
      }
      const pdf = await this.pdfService.generate(tenantId, orderId);
      await this.mailService.sendMail(tenantId, {
        to: order.supplier.email,
        subject: `Pedido ${order.orderNumber}`,
        text: this.buildMessage(order),
        attachments: [
          {
            filename: `${order.orderNumber}.pdf`,
            content: pdf,
            contentType: "application/pdf",
          },
        ],
      });
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.purchaseOrder.update({
        where: { id: order.id },
        data: {
          status: PurchaseOrderStatus.ENVIADO,
          sentAt: new Date(),
          sentVia: channel,
          sentBy: userId,
        },
      }),
      this.prisma.purchaseOrderEvent.create({
        data: {
          orderId: order.id,
          type: "SENT",
          channel,
          userId,
          ...(channel === "EMAIL"
            ? { payload: { to: order.supplier.email } }
            : {}),
        },
      }),
    ]);
    return updated;
  }

  /** Texto plano del pedido (cuerpo de email y mensaje de WhatsApp). */
  buildMessage(order: {
    orderNumber: string;
    notes?: string | null;
    supplier: { name: string };
    location?: { name: string } | null;
    lines: {
      quantity: number;
      unit?: string | null;
      product?: { name: string } | null;
      productId: string;
    }[];
  }): string {
    const header = `Pedido ${order.orderNumber}${order.location?.name ? ` (${order.location.name})` : ""}`;
    const lines = order.lines.map(
      (l) =>
        `• ${l.product?.name ?? l.productId}: ${l.quantity}${l.unit ? ` ${l.unit}` : ""}`,
    );
    const notes = order.notes ? `\nNotas: ${order.notes}` : "";
    return `Hola ${order.supplier.name},\n\n${header}:\n${lines.join("\n")}${notes}\n\nGracias.`;
  }

  /** Teléfono a dígitos para wa.me; asume prefijo 34 si son 9 dígitos (ES). */
  private normalizePhone(phone?: string | null): string | null {
    if (!phone) {
      return null;
    }
    const digits = phone.replace(/\D/g, "");
    if (!digits) {
      return null;
    }
    return digits.length === 9 ? `34${digits}` : digits;
  }

  private async findSendableOrder(
    tenantId: string,
    orderId: string,
    requireSendable: boolean,
  ) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id: orderId, tenantId },
      include: ORDER_WITH_SUPPLIER,
    });
    if (!order) {
      throw new NotFoundException("Pedido no encontrado");
    }
    if (requireSendable && !SENDABLE.includes(order.status)) {
      throw new BadRequestException(
        `Solo se pueden enviar pedidos en ${SENDABLE.join(" o ")} (actual: ${order.status}).`,
      );
    }
    if (order.lines.length === 0) {
      throw new BadRequestException("El pedido no tiene líneas.");
    }
    return order;
  }
}
