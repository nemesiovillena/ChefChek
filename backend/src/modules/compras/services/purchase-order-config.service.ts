import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import {
  PurchaseOrderConfigResponse,
  UpdatePurchaseOrderConfigDto,
} from "../dto/purchase-order-config.dto";

const SUPPLIER_NOTE_KEY = "PURCHASE_ORDER_SUPPLIER_NOTE";
export const DEFAULT_SUPPLIER_NOTE =
  "Si no dispone de algún artículo, por favor, comuníquelo.";

/** Texto fijo añadido a los pedidos generados desde una lista, configurable por tenant (Ajustes). */
@Injectable()
export class PurchaseOrderConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(tenantId: string): Promise<PurchaseOrderConfigResponse> {
    const row = await this.prisma.configuration.findUnique({
      where: { tenantId_key: { tenantId, key: SUPPLIER_NOTE_KEY } },
    });
    return { supplierNote: row?.value ?? DEFAULT_SUPPLIER_NOTE };
  }

  /** Texto plano listo para usar en generateOrder(); nunca null. */
  async getSupplierNote(tenantId: string): Promise<string> {
    const { supplierNote } = await this.getConfig(tenantId);
    return supplierNote;
  }

  async updateConfig(
    tenantId: string,
    dto: UpdatePurchaseOrderConfigDto,
    userId: string,
  ): Promise<PurchaseOrderConfigResponse> {
    if (dto.supplierNote !== undefined) {
      await this.prisma.configuration.upsert({
        where: { tenantId_key: { tenantId, key: SUPPLIER_NOTE_KEY } },
        create: {
          tenantId,
          key: SUPPLIER_NOTE_KEY,
          value: dto.supplierNote,
          category: "COMPRAS",
          description:
            "Texto fijo añadido a los pedidos generados desde una lista de compra",
          updatedBy: userId,
        },
        update: {
          value: dto.supplierNote,
          updatedBy: userId,
        },
      });
    }
    return this.getConfig(tenantId);
  }
}
