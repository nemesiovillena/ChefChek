import { BadRequestException, Injectable } from "@nestjs/common";
import { PurchaseOrderStatus } from "@prisma/client";
import { PrismaService } from "../../common/services/prisma.service";
import { AlbaranesService } from "../albaranes/albaranes.service";
import {
  CorreoMailboxService,
  MailPartDownload,
} from "./correo-mailbox.service";

/**
 * Pasa un adjunto del correo (albarán o factura del proveedor) a un albarán de
 * ChefChek sin descargarlo en el navegador: el servidor lo coge del buzón y lo
 * entrega a la misma lectura con IA que la subida manual de albaranes.
 */

/** Pedidos que admiten recepción: los mismos que acepta la subida de albaranes. */
const RECEIVABLE = [
  PurchaseOrderStatus.ENVIADO,
  PurchaseOrderStatus.RECIBIDO_PARCIAL,
];

/** Dominios de correo genéricos: con ellos solo vale la dirección exacta. */
const GENERIC_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.es",
  "outlook.com",
  "outlook.es",
  "live.com",
  "yahoo.com",
  "yahoo.es",
  "icloud.com",
  "me.com",
  "telefonica.net",
]);

export interface AlbaranOrderOption {
  id: string;
  orderNumber: string;
  status: PurchaseOrderStatus;
  supplierName: string;
  sentAt: string | null;
  expectedTotal: number;
  /** El proveedor del pedido es quien envía el correo (por email o dominio). */
  fromSender: boolean;
}

const domainOf = (email: string) => email.split("@")[1] ?? "";

/** «Bodegas Villena, S.L.» → «bodegasvillena»: sin tildes, signos ni forma jurídica. */
export function nameKey(text: string | null | undefined): string {
  return (text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(
      /\b(s\.?\s?l\.?\s?u?|s\.?\s?a\.?\s?u?|s\.?\s?coop|cb|c\.b)\.?(?=\s|$|,)/g,
      " ",
    )
    .replace(/[^a-z0-9]/g, "");
}

/** Claves cortas («sa», «bar») darían falsos positivos. */
const MIN_NAME_KEY = 5;

/**
 * Sin email guardado: ¿el nombre del proveedor coincide con el dominio del
 * remitente (bodegasvillena.es) o con su nombre visible («Bardisa»)?
 */
export function senderMatchesSupplierName(
  sender: { address?: string; name?: string },
  supplierName: string,
): boolean {
  const supplier = nameKey(supplierName);
  if (supplier.length < MIN_NAME_KEY) {
    return false;
  }
  const domain = domainOf(sender.address?.trim().toLowerCase() ?? "");
  const candidates = [
    GENERIC_DOMAINS.has(domain) ? "" : nameKey(domain.split(".")[0]),
    nameKey(sender.name),
  ].filter((c) => c.length >= MIN_NAME_KEY);
  return candidates.some((c) => c.includes(supplier) || supplier.includes(c));
}

/** ¿El correo lo manda este proveedor? Misma dirección o, si no es genérico, mismo dominio. */
export function senderMatchesSupplier(
  sender: string | undefined,
  supplierEmail: string | null | undefined,
): boolean {
  const from = sender?.trim().toLowerCase();
  const sup = supplierEmail?.trim().toLowerCase();
  if (!from || !sup || !from.includes("@") || !sup.includes("@")) {
    return false;
  }
  if (from === sup) {
    return true;
  }
  const domain = domainOf(from);
  return !GENERIC_DOMAINS.has(domain) && domain === domainOf(sup);
}

/**
 * Tipo real del archivo por sus primeros bytes: muchos proveedores mandan el
 * PDF como `application/octet-stream`. Solo PDF e imágenes que lee la IA.
 */
export function albaranFileType(buffer: Buffer): string | null {
  const head = buffer.subarray(0, 12);
  if (head.subarray(0, 5).toString("latin1") === "%PDF-") {
    return "application/pdf";
  }
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return "image/jpeg";
  }
  if (head.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) {
    return "image/png";
  }
  if (
    head.subarray(0, 4).toString("latin1") === "RIFF" &&
    head.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

@Injectable()
export class CorreoAlbaranService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailbox: CorreoMailboxService,
    private readonly albaranes: AlbaranesService,
  ) {}

  /** Pedidos abiertos; primero los del proveedor que envía el correo. */
  async openOrders(
    tenantId: string,
    sender: { address?: string; name?: string } = {},
  ): Promise<AlbaranOrderOption[]> {
    const orders = await this.prisma.purchaseOrder.findMany({
      where: { tenantId, deletedAt: null, status: { in: RECEIVABLE } },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        sentAt: true,
        createdAt: true,
        expectedTotal: true,
        supplier: { select: { name: true, email: true } },
      },
      orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
      take: 100,
    });
    const options = orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      supplierName: o.supplier.name,
      sentAt: (o.sentAt ?? o.createdAt)?.toISOString() ?? null,
      expectedTotal: o.expectedTotal,
      fromSender:
        senderMatchesSupplier(sender.address, o.supplier.email) ||
        senderMatchesSupplierName(sender, o.supplier.name),
    }));
    // Orden estable: los del remitente arriba, el resto como venían (más recientes primero)
    return [
      ...options.filter((o) => o.fromSender),
      ...options.filter((o) => !o.fromSender),
    ];
  }

  /** Coge el adjunto del buzón y crea el albarán (IA con la configuración guardada del restaurante). */
  async createFromAttachment(
    tenantId: string,
    target: {
      folder: string;
      uid: number;
      uidValidity: string;
      part: string;
      purchaseOrderId?: string;
    },
  ): Promise<{ albaranId: string; file: MailPartDownload }> {
    const file = await this.mailbox.downloadPart(
      tenantId,
      target.folder,
      target.uid,
      target.part,
      target.uidValidity,
    );
    const mimetype = albaranFileType(file.buffer);
    if (!mimetype) {
      throw new BadRequestException(
        "Solo se pueden pasar a albarán archivos PDF o imágenes (JPG, PNG, WEBP).",
      );
    }
    const upload = {
      fieldname: "file",
      originalname: file.filename,
      encoding: "7bit",
      mimetype,
      size: file.buffer.length,
      buffer: file.buffer,
    } as Express.Multer.File;
    const albaran = await this.albaranes.createFromUpload(
      [upload],
      tenantId,
      undefined,
      undefined,
      target.purchaseOrderId,
    );
    return { albaranId: albaran.id, file };
  }
}
