import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import {
  decryptSecret,
  encryptSecret,
} from "../../../common/utils/encryption.util";
import {
  RecipeCaptureConfigDto,
  RecipeCaptureConfigPublic,
  RecipeCaptureConfigResolved,
} from "./dto/recipe-capture-config.dto";

/**
 * Configuración del modelo IA de la Captura de recetas, por tenant.
 * Independiente de la del Asistente IA: guarda su propio proveedor/modelo/clave
 * en la tabla `Configuration` (categoría "RECIPE_CAPTURE") con su propio salt de
 * cifrado. Así el tenant puede usar un modelo con visión solo para capturas sin
 * tocar el del chat.
 */
const RECIPE_CAPTURE_CATEGORY = "RECIPE_CAPTURE";
const KEY_PROVIDER = "recipe_capture.provider";
const KEY_MODEL = "recipe_capture.model";
const KEY_API_KEY = "recipe_capture.api_key";
const SALT = "chefchek-recipe-capture";

@Injectable()
export class RecipeCaptureConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicConfig(tenantId: string): Promise<RecipeCaptureConfigPublic> {
    const v = await this.readValues(tenantId);
    return {
      provider: (v.provider as RecipeCaptureConfigPublic["provider"]) ?? null,
      model: v.model ?? null,
      hasApiKey: Boolean(v.apiKey),
      isReady: Boolean(v.provider && v.model && v.apiKey),
    };
  }

  async saveConfig(
    tenantId: string,
    dto: RecipeCaptureConfigDto,
    userId: string,
  ): Promise<RecipeCaptureConfigPublic> {
    const entries: Array<[string, string, string]> = [];
    if (dto.provider !== undefined) {
      entries.push([
        KEY_PROVIDER,
        dto.provider,
        "Proveedor IA de la captura de recetas",
      ]);
    }
    if (dto.model !== undefined) {
      entries.push([
        KEY_MODEL,
        dto.model,
        "Modelo IA de la captura de recetas",
      ]);
    }
    // apiKey vacía/omitida → conservar la existente (mismo patrón que OCR/asistente).
    if (dto.apiKey !== undefined && dto.apiKey !== "") {
      entries.push([
        KEY_API_KEY,
        encryptSecret(dto.apiKey, SALT),
        "API key del proveedor IA de captura de recetas (cifrada)",
      ]);
    }

    if (entries.length) {
      await this.prisma.$transaction(
        entries.map(([key, value, description]) =>
          this.prisma.configuration.upsert({
            where: { tenantId_key: { tenantId, key } },
            create: {
              tenantId,
              key,
              value,
              category: RECIPE_CAPTURE_CATEGORY,
              description,
              updatedBy: userId,
            },
            update: { value, updatedBy: userId },
          }),
        ),
      );
    }
    return this.getPublicConfig(tenantId);
  }

  /**
   * Resuelve la config completa (con la key descifrada). Devuelve null si falta
   * proveedor, modelo o clave — el llamador decide si cae a otra config.
   */
  async resolveForRequest(
    tenantId: string,
  ): Promise<RecipeCaptureConfigResolved | null> {
    const v = await this.readValues(tenantId);
    if (!v.provider || !v.model || !v.apiKey) {
      return null;
    }
    return {
      provider: v.provider as RecipeCaptureConfigResolved["provider"],
      model: v.model,
      apiKey: decryptSecret(v.apiKey, SALT),
    };
  }

  private async readValues(
    tenantId: string,
  ): Promise<{ provider?: string; model?: string; apiKey?: string }> {
    const rows = await this.prisma.configuration.findMany({
      where: { tenantId, key: { in: [KEY_PROVIDER, KEY_MODEL, KEY_API_KEY] } },
    });
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return {
      provider: byKey[KEY_PROVIDER],
      model: byKey[KEY_MODEL],
      apiKey: byKey[KEY_API_KEY],
    };
  }
}
