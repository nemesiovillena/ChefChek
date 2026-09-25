import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import { ChecklistConsumerModule } from "../dto/checklist-template.dto";
import {
  CreateChecklistAssetDto,
  UpdateChecklistAssetDto,
} from "../dto/checklist-asset.dto";
import { addMonthsClamped } from "../util/checklist-maintenance-date.util";

export interface ChecklistStarterAsset {
  asset: CreateChecklistAssetDto;
  plan: {
    title: string;
    periodicityMonths: number;
    externalProvider?: boolean;
  };
}

/**
 * Equipos/instalaciones (el inventario) del motor de mantenimiento compartido
 * (fase 4). Mismo contrato que `ChecklistTemplateService`: filtra siempre por
 * `usedByModules`, siembra idempotente por `externalCode`.
 */
@Injectable()
export class ChecklistAssetService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    tenantId: string,
    module: ChecklistConsumerModule,
    category?: string,
  ) {
    return this.prisma.checklistAsset.findMany({
      where: {
        tenantId,
        usedByModules: { has: module },
        isActive: true,
        ...(category ? { category } : {}),
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
  }

  async getOneVisible(
    tenantId: string,
    module: ChecklistConsumerModule,
    id: string,
  ) {
    const asset = await this.prisma.checklistAsset.findFirst({
      where: { id, tenantId, usedByModules: { has: module } },
    });
    if (!asset) {
      throw new NotFoundException("Equipo no encontrado");
    }
    return asset;
  }

  async create(
    tenantId: string,
    module: ChecklistConsumerModule,
    dto: CreateChecklistAssetDto,
  ) {
    return this.prisma.checklistAsset.create({
      data: {
        tenantId,
        name: dto.name,
        externalCode: dto.externalCode,
        category: dto.category,
        usedByModules: [module],
        location: dto.location,
        provider: dto.provider,
      },
    });
  }

  async update(
    tenantId: string,
    module: ChecklistConsumerModule,
    id: string,
    dto: UpdateChecklistAssetDto,
  ) {
    await this.getOneVisible(tenantId, module, id);
    return this.prisma.checklistAsset.update({
      where: { id },
      data: {
        name: dto.name,
        externalCode: dto.externalCode,
        category: dto.category,
        location: dto.location,
        provider: dto.provider,
        isActive: dto.isActive,
      },
    });
  }

  async archive(tenantId: string, module: ChecklistConsumerModule, id: string) {
    await this.getOneVisible(tenantId, module, id);
    return this.prisma.checklistAsset.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /** Igual que `ChecklistTemplateService.seedStarter`: dedup por `(tenantId, externalCode)`, añade el módulo si ya existía. */
  async seedStarterAsset(
    tenantId: string,
    module: ChecklistConsumerModule,
    starter: ChecklistStarterAsset,
  ) {
    let asset = await this.prisma.checklistAsset.findFirst({
      where: { tenantId, externalCode: starter.asset.externalCode },
    });
    if (!asset) {
      asset = await this.create(tenantId, module, starter.asset);
    } else if (!asset.usedByModules.includes(module)) {
      asset = await this.prisma.checklistAsset.update({
        where: { id: asset.id },
        data: { usedByModules: { push: module } },
      });
    }

    const existingPlan = await this.prisma.checklistMaintenancePlan.findFirst({
      where: { tenantId, assetId: asset.id, title: starter.plan.title },
    });
    if (!existingPlan) {
      await this.prisma.checklistMaintenancePlan.create({
        data: {
          tenantId,
          assetId: asset.id,
          title: starter.plan.title,
          periodicityMonths: starter.plan.periodicityMonths,
          nextDueAt: addMonthsClamped(
            new Date(),
            starter.plan.periodicityMonths,
          ),
          externalProvider: starter.plan.externalProvider ?? false,
        },
      });
    }

    return asset;
  }
}
