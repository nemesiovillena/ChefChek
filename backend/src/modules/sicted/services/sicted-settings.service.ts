import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import { SICTED_COMPLEMENTARY_GROUPS } from "../constants/sicted-complementary-modules";

/**
 * Configuración SICTED del tenant (Configuración → SICTED). Hoy solo guarda
 * qué módulos complementarios del MBP aplican al negocio; la fila se crea al
 * primer acceso para que los consumidores no tengan que tratar el caso vacío.
 */
@Injectable()
export class SictedSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(tenantId: string) {
    return this.prisma.sictedSettings.upsert({
      where: { tenantId },
      create: { tenantId },
      update: {},
    });
  }

  async enabledComplementaryModules(tenantId: string): Promise<string[]> {
    const settings = await this.prisma.sictedSettings.findUnique({
      where: { tenantId },
      select: { enabledComplementaryModules: true },
    });
    return settings?.enabledComplementaryModules ?? [];
  }

  /** Grupos de la Guía con su estado; un grupo cuenta como activo si lo están todos sus módulos. */
  async complementaryGroups(tenantId: string) {
    const enabled = new Set(await this.enabledComplementaryModules(tenantId));
    return SICTED_COMPLEMENTARY_GROUPS.map((g) => ({
      ...g,
      enabled: g.moduleCodes.every((c) => enabled.has(c)),
    }));
  }

  /** Sustituye la selección completa a partir de las claves de grupo marcadas. */
  async setComplementaryGroups(tenantId: string, groupKeys: string[]) {
    const keys = new Set(groupKeys);
    const moduleCodes = SICTED_COMPLEMENTARY_GROUPS.filter((g) =>
      keys.has(g.key),
    ).flatMap((g) => g.moduleCodes);
    await this.prisma.sictedSettings.upsert({
      where: { tenantId },
      create: { tenantId, enabledComplementaryModules: moduleCodes },
      update: { enabledComplementaryModules: moduleCodes },
    });
    return this.complementaryGroups(tenantId);
  }
}
