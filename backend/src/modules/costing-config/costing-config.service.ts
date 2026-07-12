import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import {
  CostingConfigResponse,
  UpdateCostingConfigDto,
} from "./dto/costing-config.dto";

const TARGET_COST_PERCENTAGE_KEY = "RECIPE_TARGET_COST_PERCENTAGE";
const THEORETICAL_PRICE_MULTIPLIER_KEY = "RECIPE_THEORETICAL_PRICE_MULTIPLIER";
const DEFAULT_TARGET_COST_PERCENTAGE = 30;
const DEFAULT_THEORETICAL_PRICE_MULTIPLIER = 4;

@Injectable()
export class CostingConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(tenantId: string): Promise<CostingConfigResponse> {
    const rows = await this.prisma.configuration.findMany({
      where: {
        tenantId,
        key: {
          in: [TARGET_COST_PERCENTAGE_KEY, THEORETICAL_PRICE_MULTIPLIER_KEY],
        },
      },
    });
    const targetCostPercentageRow = rows.find(
      (r) => r.key === TARGET_COST_PERCENTAGE_KEY,
    );
    const multiplierRow = rows.find(
      (r) => r.key === THEORETICAL_PRICE_MULTIPLIER_KEY,
    );

    return {
      targetCostPercentage: targetCostPercentageRow
        ? Number(targetCostPercentageRow.value)
        : DEFAULT_TARGET_COST_PERCENTAGE,
      theoreticalPriceMultiplier: multiplierRow
        ? Number(multiplierRow.value)
        : DEFAULT_THEORETICAL_PRICE_MULTIPLIER,
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

    if (dto.theoreticalPriceMultiplier !== undefined) {
      await this.prisma.configuration.upsert({
        where: {
          tenantId_key: { tenantId, key: THEORETICAL_PRICE_MULTIPLIER_KEY },
        },
        create: {
          tenantId,
          key: THEORETICAL_PRICE_MULTIPLIER_KEY,
          value: String(dto.theoreticalPriceMultiplier),
          category: "COSTING",
          description:
            "Multiplicador aplicado al coste por ración para calcular el PVP teórico",
          updatedBy: userId,
        },
        update: {
          value: String(dto.theoreticalPriceMultiplier),
          updatedBy: userId,
        },
      });
    }

    return this.getConfig(tenantId);
  }
}
