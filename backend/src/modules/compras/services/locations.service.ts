import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import { CreateLocationDto, UpdateLocationDto } from "../dto/location.dto";

/**
 * Locales del tenant (multi-local). Cada tenant tiene siempre un local por
 * defecto (creado por backfill en la migración add_compras_foundations o al
 * promover otro con isDefault). El local por defecto no puede eliminarse ni
 * desactivarse: las entidades de compras con locationId null se interpretan
 * contra él.
 */
@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.location.findMany({
      where: { tenantId },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  }

  async create(tenantId: string, dto: CreateLocationDto) {
    if (dto.isDefault) {
      await this.unsetCurrentDefault(tenantId);
    }
    return this.prisma.location.create({
      data: {
        tenantId,
        name: dto.name,
        address: dto.address,
        isDefault: dto.isDefault ?? false,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateLocationDto) {
    const location = await this.findOwned(tenantId, id);

    if (location.isDefault && dto.isDefault === false) {
      throw new BadRequestException(
        "No se puede quitar el local por defecto directamente; marca otro local como predeterminado.",
      );
    }
    if (location.isDefault && dto.isActive === false) {
      throw new BadRequestException(
        "El local por defecto no puede desactivarse.",
      );
    }
    if (dto.isDefault && !location.isDefault) {
      await this.unsetCurrentDefault(tenantId);
    }

    return this.prisma.location.update({
      where: { id },
      data: {
        name: dto.name,
        address: dto.address,
        isDefault: dto.isDefault,
        isActive: dto.isActive,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const location = await this.findOwned(tenantId, id);
    if (location.isDefault) {
      throw new BadRequestException(
        "El local por defecto no puede eliminarse.",
      );
    }
    // delete → soft-delete (deletedAt) vía extensión de PrismaService
    return this.prisma.location.delete({ where: { id } });
  }

  private async findOwned(tenantId: string, id: string) {
    const location = await this.prisma.location.findFirst({
      where: { id, tenantId },
    });
    if (!location) {
      throw new NotFoundException("Local no encontrado");
    }
    return location;
  }

  private async unsetCurrentDefault(tenantId: string) {
    await this.prisma.location.updateMany({
      where: { tenantId, isDefault: true },
      data: { isDefault: false },
    });
  }
}
