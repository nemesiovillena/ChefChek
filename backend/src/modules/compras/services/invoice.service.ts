import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import { CreateInvoiceDto, InvoicesQueryDto } from "../dto/invoice.dto";

/**
 * Registro mínimo de factura (sin líneas ni vencimientos gestionados):
 * enlaza opcionalmente con el albarán de recepción y/o el pedido de compra.
 * Ampliación futura si se necesita un módulo de facturación completo.
 */
@Injectable()
export class InvoiceService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, query: InvoicesQueryDto) {
    return this.prisma.invoice.findMany({
      where: {
        tenantId,
        ...(query.albaranId ? { albaranId: query.albaranId } : {}),
        ...(query.purchaseOrderId
          ? { purchaseOrderId: query.purchaseOrderId }
          : {}),
      },
      orderBy: { issuedAt: "desc" },
    });
  }

  async create(tenantId: string, dto: CreateInvoiceDto) {
    let supplierName = dto.supplier;

    if (!supplierName) {
      if (dto.purchaseOrderId) {
        const order = await this.prisma.purchaseOrder.findFirst({
          where: { id: dto.purchaseOrderId, tenantId },
          include: { supplier: { select: { name: true } } },
        });
        supplierName = order?.supplier.name;
      } else if (dto.albaranId) {
        const albaran = await this.prisma.albaran.findFirst({
          where: { id: dto.albaranId, tenantId },
          include: { supplier: { select: { name: true } } },
        });
        supplierName = albaran?.supplier?.name ?? undefined;
      }
    }
    if (!supplierName) {
      throw new BadRequestException(
        "Indica el proveedor o vincula un albarán/pedido con proveedor asignado.",
      );
    }

    return this.prisma.invoice.create({
      data: {
        tenantId,
        invoiceNumber: dto.invoiceNumber,
        supplier: supplierName,
        totalAmount: dto.totalAmount,
        status: "REGISTRADA",
        issuedAt: new Date(dto.issuedAt),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        albaranId: dto.albaranId,
        purchaseOrderId: dto.purchaseOrderId,
        fileUrl: dto.fileUrl,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
    });
    if (!invoice) {
      throw new BadRequestException("Factura no encontrada");
    }
    return this.prisma.invoice.delete({ where: { id } });
  }
}
