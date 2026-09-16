import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import {
  ConservationDefaultsDto,
  ConservationDefaultsPublic,
} from "./dto/conservation-defaults.dto";

/**
 * Valores por defecto de conservación/vida útil, por tenant. Alimentan el
 * autorrelleno del ConservationFieldset (compartido por Recetas y Artículos)
 * al elegir "Refrigerado" o "Congelado", para no tener que teclearlos cada
 * vez. Editables en Ajustes; guardados en la tabla Configuration genérica
 * (categoría "CONSERVATION"), sin migración de esquema.
 */
const CATEGORY = "CONSERVATION";
const KEY = "CONSERVATION_DEFAULTS";

export const BUILTIN_CONSERVATION_DEFAULTS: ConservationDefaultsPublic = {
  refrigerated: { tempMin: 2, tempMax: 5, shelfLifeDays: 7 },
  frozen: { tempMin: -18, tempMax: -10, shelfLifeDays: 90 },
};

@Injectable()
export class ConservationDefaultsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDefaults(tenantId: string): Promise<ConservationDefaultsPublic> {
    const row = await this.prisma.configuration.findUnique({
      where: { tenantId_key: { tenantId, key: KEY } },
    });
    if (!row) {
      return BUILTIN_CONSERVATION_DEFAULTS;
    }
    try {
      const parsed = JSON.parse(
        row.value,
      ) as Partial<ConservationDefaultsPublic>;
      return {
        refrigerated: {
          ...BUILTIN_CONSERVATION_DEFAULTS.refrigerated,
          ...parsed.refrigerated,
        },
        frozen: {
          ...BUILTIN_CONSERVATION_DEFAULTS.frozen,
          ...parsed.frozen,
        },
      };
    } catch {
      return BUILTIN_CONSERVATION_DEFAULTS;
    }
  }

  async setDefaults(
    tenantId: string,
    dto: ConservationDefaultsDto,
    userId: string,
  ): Promise<ConservationDefaultsPublic> {
    const current = await this.getDefaults(tenantId);
    const next: ConservationDefaultsPublic = {
      refrigerated: {
        tempMin: dto.refrigeratedTempMin ?? current.refrigerated.tempMin,
        tempMax: dto.refrigeratedTempMax ?? current.refrigerated.tempMax,
        shelfLifeDays:
          dto.refrigeratedShelfLifeDays ?? current.refrigerated.shelfLifeDays,
      },
      frozen: {
        tempMin: dto.frozenTempMin ?? current.frozen.tempMin,
        tempMax: dto.frozenTempMax ?? current.frozen.tempMax,
        shelfLifeDays: dto.frozenShelfLifeDays ?? current.frozen.shelfLifeDays,
      },
    };
    this.validate(next);

    await this.prisma.configuration.upsert({
      where: { tenantId_key: { tenantId, key: KEY } },
      create: {
        tenantId,
        key: KEY,
        value: JSON.stringify(next),
        category: CATEGORY,
        description:
          "Valores por defecto de conservación/vida útil (refrigerado/congelado)",
        updatedBy: userId,
      },
      update: { value: JSON.stringify(next), updatedBy: userId },
    });
    return next;
  }

  private validate(v: ConservationDefaultsPublic): void {
    for (const [label, c] of Object.entries(v)) {
      if (!Number.isFinite(c.tempMin) || !Number.isFinite(c.tempMax)) {
        throw new BadRequestException(`Temperaturas no válidas en "${label}"`);
      }
      if (c.tempMin > c.tempMax) {
        throw new BadRequestException(
          `La temperatura mínima no puede superar la máxima en "${label}"`,
        );
      }
      if (
        !Number.isFinite(c.shelfLifeDays) ||
        c.shelfLifeDays <= 0 ||
        !Number.isInteger(c.shelfLifeDays)
      ) {
        throw new BadRequestException(
          `Vida útil (días) no válida en "${label}"`,
        );
      }
    }
  }
}
