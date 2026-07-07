import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import {
  CostingConfigResponse,
  UpdateCostingConfigDto,
} from "./dto/costing-config.dto";

const TARGET_COST_PERCENTAGE_KEY = "RECIPE_TARGET_COST_PERCENTAGE";
const DEFAULT_TARGET_COST_PERCENTAGE = 30;

@Injectable()
export class CostingConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(tenantId: string): Promise<CostingConfigResponse> {
    const row = await this.prisma.configuration.findUnique({
      where: {
        tenantId_key: { tenantId, key: TARGET_COST_PERCENTAGE_KEY },
      },
    });

    return {
      targetCostPercentage: row
        ? Number(row.value)
        : DEFAULT_TARGET_COST_PERCENTAGE,
    };
  }

  async updateConfig(
    tenantId: string,
    dto: UpdateCostingConfigDto,
    userId: string,
  ): Promise<CostingConfigResponse> {
    if (dto.targetCostPercentage !== undefined) {
      await this.prisma.configuration.upsert({
        where: {
          tenantId_key: { tenantId, key: TARGET_COST_PERCENTAGE_KEY },
        },
        create: {
          tenantId,
          key: TARGET_COST_PERCENTAGE_KEY,
          value: String(dto.targetCostPercentage),
          category: "COSTING",
          description:
            "Coste objetivo máximo (%) aplicado por defecto a las recetas",
          updatedBy: userId,
        },
        update: {
          value: String(dto.targetCostPercentage),
          updatedBy: userId,
        },
      });
    }

    return this.getConfig(tenantId);
  }
}
