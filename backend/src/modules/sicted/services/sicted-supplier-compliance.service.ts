import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import { UpsertSupplierComplianceDto } from "../dto/sicted-supplier-compliance.dto";

/**
 * Perfil de cumplimiento por proveedor (PROV.1) — nombre/contacto/RSI ya son
 * evidencia en `Supplier` (fuera de este módulo); aquí solo los campos que
 * `Supplier` no tiene. NO append-only: es un perfil, se actualiza (upsert
 * por `(tenantId, supplierId)`), a diferencia del resto de la fase.
 */
@Injectable()
export class SictedSupplierComplianceService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    return this.prisma.sictedSupplierComplianceProfile.findMany({
      where: { tenantId },
    });
  }

  async getOne(tenantId: string, supplierId: string) {
    return this.prisma.sictedSupplierComplianceProfile.findUnique({
      where: { tenantId_supplierId: { tenantId, supplierId } },
    });
  }

  async upsert(
    tenantId: string,
    supplierId: string,
    updatedByName: string,
    dto: UpsertSupplierComplianceDto,
  ) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenantId, deletedAt: null },
    });
    if (!supplier) {
      throw new NotFoundException("Proveedor no encontrado");
    }
    return this.prisma.sictedSupplierComplianceProfile.upsert({
      where: { tenantId_supplierId: { tenantId, supplierId } },
      create: {
        tenantId,
        supplierId,
        suppliedCategories: dto.suppliedCategories ?? [],
        serviceUnits: dto.serviceUnits ?? [],
        hasSafetyDataSheets: dto.hasSafetyDataSheets,
        hasIndustrialRegistry: dto.hasIndustrialRegistry,
        hasTechnicalSheets: dto.hasTechnicalSheets,
        qualityCertification: dto.qualityCertification,
        internalRulesGivenAt: dto.internalRulesGivenAt,
        firstContactAt: dto.firstContactAt,
        updatedByName,
      },
      update: {
        suppliedCategories: dto.suppliedCategories,
        serviceUnits: dto.serviceUnits,
        hasSafetyDataSheets: dto.hasSafetyDataSheets,
        hasIndustrialRegistry: dto.hasIndustrialRegistry,
        hasTechnicalSheets: dto.hasTechnicalSheets,
        qualityCertification: dto.qualityCertification,
        internalRulesGivenAt: dto.internalRulesGivenAt,
        firstContactAt: dto.firstContactAt,
        updatedByName,
      },
    });
  }
}
