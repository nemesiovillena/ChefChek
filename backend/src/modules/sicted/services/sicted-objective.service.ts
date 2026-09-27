import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import {
  CreateObjectiveDto,
  UpdateObjectiveDto,
} from "../dto/sicted-objective.dto";

/**
 * Objetivos anuales (fase 9, sub-PR 2) — entidad viva, sin trigger de
 * inalterabilidad: `currentValue`/`status` se actualizan durante todo el
 * año, no es evidencia de un evento puntual.
 */
@Injectable()
export class SictedObjectiveService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, year?: number) {
    return this.prisma.sictedObjective.findMany({
      where: { tenantId, ...(year ? { year } : {}) },
      orderBy: [{ year: "desc" }, { createdAt: "asc" }],
    });
  }

  async getOneVisible(tenantId: string, id: string) {
    const objective = await this.prisma.sictedObjective.findFirst({
      where: { id, tenantId },
    });
    if (!objective) {
      throw new NotFoundException("Objetivo no encontrado");
    }
    return objective;
  }

  async create(tenantId: string, dto: CreateObjectiveDto) {
    return this.prisma.sictedObjective.create({
      data: {
        tenantId,
        year: dto.year,
        title: dto.title,
        indicator: dto.indicator,
        target: dto.target,
        currentValue: dto.currentValue,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateObjectiveDto) {
    await this.getOneVisible(tenantId, id);
    return this.prisma.sictedObjective.update({
      where: { id },
      data: {
        title: dto.title,
        indicator: dto.indicator,
        target: dto.target,
        currentValue: dto.currentValue,
        status: dto.status,
      },
    });
  }
}
