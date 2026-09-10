import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import {
  A4_BUILTIN_PRESETS,
  A4Format,
  BUILTIN_A4_FORMATS,
  LabelSpec,
  thermalSpec,
} from "../constants/label-presets";

const THERMAL_PROFILES_KEY = "ETIQUETADO_THERMAL_PROFILES";
const DEFAULT_FORMAT_KEY = "ETIQUETADO_DEFAULT_FORMAT";

export interface ThermalProfile {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
}

/**
 * Perfiles de etiquetadora térmica por defecto para un tenant nuevo. Las hojas
 * A4 no se configuran (son formatos estándar built-in); solo la térmica, que
 * depende de la impresora del usuario.
 */
export const DEFAULT_THERMAL_PROFILES: ThermalProfile[] = [
  {
    id: "default-57x40",
    name: "Térmica 57 × 40 mm",
    widthMm: 57,
    heightMm: 40,
  },
  {
    id: "default-57x32",
    name: "Térmica 57 × 32 mm",
    widthMm: 57,
    heightMm: 32,
  },
];

const MM_MIN = 20;
const MM_MAX = 200;

@Injectable()
export class EtiquetadoConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getThermalProfiles(tenantId: string): Promise<ThermalProfile[]> {
    const row = await this.prisma.configuration.findUnique({
      where: { tenantId_key: { tenantId, key: THERMAL_PROFILES_KEY } },
    });
    if (!row) {
      return DEFAULT_THERMAL_PROFILES;
    }
    try {
      const parsed = JSON.parse(row.value) as ThermalProfile[];
      return Array.isArray(parsed) && parsed.length
        ? parsed
        : DEFAULT_THERMAL_PROFILES;
    } catch {
      return DEFAULT_THERMAL_PROFILES;
    }
  }

  /** Formato de impresión por defecto ('thermal:<id>' o preset A4). Null = sin preferencia. */
  async getDefaultFormat(tenantId: string): Promise<string | null> {
    const row = await this.prisma.configuration.findUnique({
      where: { tenantId_key: { tenantId, key: DEFAULT_FORMAT_KEY } },
    });
    const value = row?.value.trim();
    return value || null;
  }

  /** Config completa para la UI: perfiles térmicos + presets A4 built-in. */
  async getConfig(tenantId: string) {
    return {
      thermalProfiles: await this.getThermalProfiles(tenantId),
      a4Presets: BUILTIN_A4_FORMATS.map((id) => ({
        id,
        name: A4_BUILTIN_PRESETS[id].name,
      })),
      defaultFormat: await this.getDefaultFormat(tenantId),
    };
  }

  /**
   * Fija (o limpia, con string vacío) el formato de impresión por defecto.
   * `profiles` permite validar contra los perfiles que se están guardando en
   * la misma petición; si no llega, se usan los actuales.
   */
  async setDefaultFormat(
    tenantId: string,
    userId: string,
    format: string,
    profiles?: ThermalProfile[],
  ): Promise<string | null> {
    const clean = format.trim();
    if (!clean) {
      await this.prisma.configuration.deleteMany({
        where: { tenantId, key: DEFAULT_FORMAT_KEY },
      });
      return null;
    }
    const list = profiles ?? (await this.getThermalProfiles(tenantId));
    const isThermal =
      clean.startsWith("thermal:") &&
      list.some((p) => `thermal:${p.id}` === clean);
    const isA4 = BUILTIN_A4_FORMATS.includes(clean as A4Format);
    if (!isThermal && !isA4) {
      throw new BadRequestException(
        "Formato por defecto no válido: elige un perfil térmico o un formato A4",
      );
    }
    await this.prisma.configuration.upsert({
      where: { tenantId_key: { tenantId, key: DEFAULT_FORMAT_KEY } },
      create: {
        tenantId,
        key: DEFAULT_FORMAT_KEY,
        value: clean,
        category: "ETIQUETADO",
        description: "Formato de impresión de etiquetas por defecto",
        updatedBy: userId,
      },
      update: { value: clean, updatedBy: userId },
    });
    return clean;
  }

  async setThermalProfiles(
    tenantId: string,
    profiles: Array<{
      id?: string;
      name: string;
      widthMm: number;
      heightMm: number;
    }>,
    userId: string,
  ): Promise<ThermalProfile[]> {
    if (!Array.isArray(profiles) || profiles.length === 0) {
      throw new BadRequestException(
        "Define al menos un perfil de etiqueta térmica",
      );
    }
    const seen = new Set<string>();
    const clean = profiles.map((p, i) => {
      const id = (p.id || `profile-${i}`).trim();
      if (seen.has(id)) {
        throw new BadRequestException(`Perfil duplicado: ${id}`);
      }
      seen.add(id);
      const width = Number(p.widthMm);
      const height = Number(p.heightMm);
      if (
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width < MM_MIN ||
        width > MM_MAX ||
        height < MM_MIN ||
        height > MM_MAX
      ) {
        throw new BadRequestException(
          `Medidas fuera de rango (${MM_MIN}–${MM_MAX} mm) en "${p.name || id}"`,
        );
      }
      return {
        id,
        name: (p.name || `Etiqueta ${width}×${height}`).trim().slice(0, 60),
        widthMm: Math.round(width * 10) / 10,
        heightMm: Math.round(height * 10) / 10,
      };
    });

    await this.prisma.configuration.upsert({
      where: { tenantId_key: { tenantId, key: THERMAL_PROFILES_KEY } },
      create: {
        tenantId,
        key: THERMAL_PROFILES_KEY,
        value: JSON.stringify(clean),
        category: "ETIQUETADO",
        description:
          "Perfiles de etiquetadora térmica (nombre + medidas en mm)",
        updatedBy: userId,
      },
      update: { value: JSON.stringify(clean), updatedBy: userId },
    });
    return clean;
  }

  /**
   * Traduce el `format` que llega en la query del endpoint de PDF a una
   * `LabelSpec` resuelta:
   * - `a4-70x37` / `a4-63x38` → preset A4 built-in.
   * - `thermal:<id>` → perfil térmico del tenant (o el primero si el id no existe).
   * - cualquier otro / vacío → primer perfil térmico del tenant.
   */
  async resolveSpec(tenantId: string, format?: string): Promise<LabelSpec> {
    if (format && BUILTIN_A4_FORMATS.includes(format as A4Format)) {
      const { name: _name, ...spec } = A4_BUILTIN_PRESETS[format as A4Format];
      return spec;
    }
    const profiles = await this.getThermalProfiles(tenantId);
    const id = format?.startsWith("thermal:") ? format.slice(8) : null;
    const profile = (id && profiles.find((p) => p.id === id)) || profiles[0];
    return thermalSpec(profile.widthMm, profile.heightMm);
  }
}
