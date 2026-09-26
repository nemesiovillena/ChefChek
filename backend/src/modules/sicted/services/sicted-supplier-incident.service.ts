import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import {
  CreateSupplierIncidentDto,
  ResolveSupplierIncidentDto,
} from "../dto/sicted-supplier-incident.dto";

/**
 * Incidencias de recepción (PROV.3, formulario real) — append-only: el
 * trigger `forbid_mutation` bloquea el DELETE y `forbid_milestone_rewrite`
 * bloquea reescribir `resolution`/`resolvedAt` una vez puestos. `supplierName`
 * se guarda como snapshot para sobrevivir al archivado del proveedor.
 */
@Injectable()
export class SictedSupplierIncidentService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, supplierId?: string) {
    return this.prisma.sictedSupplierIncident.findMany({
      where: { tenantId, ...(supplierId ? { supplierId } : {}) },
      orderBy: { occurredAt: "desc" },
      take: 200,
    });
  }

  async getOneVisible(tenantId: string, id: string) {
    const incident = await this.prisma.sictedSupplierIncident.findFirst({
      where: { id, tenantId },
    });
    if (!incident) {
      throw new NotFoundException("Incidencia no encontrada");
    }
    return incident;
  }

  async create(tenantId: string, dto: CreateSupplierIncidentDto) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, tenantId, deletedAt: null },
    });
    if (!supplier) {
      throw new NotFoundException("Proveedor no encontrado");
    }

    if (dto.albaranId) {
      const albaran = await this.prisma.albaran.findFirst({
        where: { id: dto.albaranId, tenantId, deletedAt: null },
      });
      if (!albaran) {
        throw new BadRequestException("Albarán no encontrado en este tenant");
      }
    }

    return this.prisma.sictedSupplierIncident.create({
      data: {
        tenantId,
        supplierId: dto.supplierId,
        supplierName: supplier.name,
        albaranId: dto.albaranId,
        transportOk: dto.transportOk,
        productTemperature: dto.productTemperature,
        rejectionCause: dto.rejectionCause,
        description: dto.description,
        reportedByName: dto.reportedByName,
      },
    });
  }

  /**
   * `resolution`/`resolvedAt` solo null→valor; el trigger BD lo garantiza,
   * aquí solo se traduce el error si el cliente ignoró el estado actual.
   */
  async resolve(tenantId: string, id: string, dto: ResolveSupplierIncidentDto) {
    await this.getOneVisible(tenantId, id);
    try {
      return await this.prisma.sictedSupplierIncident.update({
        where: { id },
        data: { resolution: dto.resolution, resolvedAt: new Date() },
      });
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.includes("no se puede reescribir")
      ) {
        throw new BadRequestException(
          "Esta incidencia ya estaba resuelta; no puede reescribirse.",
        );
      }
      throw err;
    }
  }
}
