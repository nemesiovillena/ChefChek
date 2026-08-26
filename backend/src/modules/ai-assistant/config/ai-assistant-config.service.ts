import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import {
  decryptSecret,
  encryptSecret,
} from "../../../common/utils/encryption.util";
import {
  AiAssistantConfigDto,
  AiAssistantConfigPublic,
  AiAssistantConfigResolved,
} from "./dto/ai-assistant-config.dto";

/**
 * Configuración del proveedor IA del asistente "Chefchek", por tenant.
 * Independiente de OcrConfigService (dominio distinto: chat de negocio vs.
 * extracción de albaranes), guardada en la misma tabla `Configuration` con
 * su propia categoría/keys y su propio salt de cifrado.
 */
const ASSISTANT_CATEGORY = "ASSISTANT";
const KEY_PROVIDER = "assistant.provider";
const KEY_MODEL = "assistant.model";
const KEY_API_KEY = "assistant.api_key";
const SALT = "chefchek-assistant";

@Injectable()
export class AiAssistantConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicConfig(tenantId: string): Promise<AiAssistantConfigPublic> {
    const v = await this.readValues(tenantId);
    return {
      provider: (v.provider as AiAssistantConfigPublic["provider"]) ?? null,
      model: v.model ?? null,
      hasApiKey: Boolean(v.apiKey),
    };
  }

  async saveConfig(
    tenantId: string,
    dto: AiAssistantConfigDto,
    userId: string,
  ): Promise<AiAssistantConfigPublic> {
    const entries: Array<[string, string, string]> = [];
    if (dto.provider !== undefined) {
      entries.push([
        KEY_PROVIDER,
        dto.provider,
        "Proveedor IA del asistente Chefchek",
      ]);
    }
    if (dto.model !== undefined) {
      entries.push([KEY_MODEL, dto.model, "Modelo IA del asistente Chefchek"]);
    }
    // apiKey vacía/omitida → conservar la existente (mismo patrón que SMTP/OCR).
    if (dto.apiKey !== undefined && dto.apiKey !== "") {
      entries.push([
        KEY_API_KEY,
        encryptSecret(dto.apiKey, SALT),
        "API key del proveedor IA del asistente (cifrada)",
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
              category: ASSISTANT_CATEGORY,
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
   * Resuelve la config completa (con la key descifrada) para que el
   * orquestador (AiAssistantService) pueda llamar al proveedor. Devuelve
   * null si falta proveedor, modelo o key — el llamador debe degradar con
   * el mensaje de "configura tu proveedor" en ese caso.
   */
  async resolveForRequest(
    tenantId: string,
  ): Promise<AiAssistantConfigResolved | null> {
    const v = await this.readValues(tenantId);
    if (!v.provider || !v.model || !v.apiKey) {
      return null;
    }
    return {
      provider: v.provider as AiAssistantConfigResolved["provider"],
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
