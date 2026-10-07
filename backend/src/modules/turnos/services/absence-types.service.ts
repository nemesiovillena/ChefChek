import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import { DEFAULT_ABSENCE_TYPES } from "../constants/default-absence-types";
import { SaveAbsenceTypeDto } from "../dto/absence.dto";

/** Tipos de ausencia del tenant. Los iniciales se siembran al primer uso. */
@Injectable()
export class AbsenceTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, includeInactive = false) {
    await this.ensureDefaults(tenantId);
    return this.prisma.absenceType.findMany({
      where: { tenantId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  async create(tenantId: string, dto: SaveAbsenceTypeDto) {
    await this.ensureDefaults(tenantId);
    return this.guardDuplicate(() =>
      this.prisma.absenceType.create({
        data: { tenantId, ...dto, name: dto.name.trim(), sortOrder: 100 },
      }),
    );
  }

  async update(tenantId: string, id: string, dto: SaveAbsenceTypeDto) {
    await this.findOwned(tenantId, id);
    return this.guardDuplicate(() =>
      this.prisma.absenceType.update({
        where: { id },
        data: { ...dto, name: dto.name.trim() },
      }),
    );
  }

  async findOwned(tenantId: string, id: string) {
    const type = await this.prisma.absenceType.findFirst({
      where: { id, tenantId },
    });
    if (!type) {
      throw new NotFoundException("Tipo de ausencia no encontrado");
    }
    return type;
  }

  private async ensureDefaults(tenantId: string) {
    const count = await this.prisma.absenceType.count({ where: { tenantId } });
    if (count > 0) {
      return;
    }
    await this.prisma.absenceType.createMany({
      data: DEFAULT_ABSENCE_TYPES.map((type, index) => ({
        tenantId,
        ...type,
        sortOrder: index,
      })),
      // Dos peticiones a la vez no deben chocar con unique(tenantId, name).
      skipDuplicates: true,
    });
  }

  private async guardDuplicate<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") {
        throw new ConflictException("Ya existe un tipo con ese nombre.");
      }
      throw error;
    }
  }
}
