import { Injectable } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";

interface CreateLotParams {
  tenantId: string;
  productId: string;
  albaranLineId: string;
  lotNumber: string;
  quantity: number;
  warehouseId?: string | null;
  supplierId?: string | null;
}

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient;

@Injectable()
export class LotService {
  /**
   * Crea un registro Lot para una línea de recepción con número de lote.
   * No-op (devuelve null) si lotNumber está vacío.
   */
  async createLotFromReception(
    client: PrismaClientOrTx,
    params: CreateLotParams,
  ) {
    if (!params.lotNumber?.trim()) {
      return null;
    }

    return client.lot.create({
      data: {
        tenantId: params.tenantId,
        productId: params.productId,
        albaranLineId: params.albaranLineId,
        lotNumber: params.lotNumber.trim(),
        quantity: params.quantity,
        warehouseId: params.warehouseId || null,
        supplierId: params.supplierId || null,
      },
    });
  }
}
