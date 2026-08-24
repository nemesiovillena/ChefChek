import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import {
  decryptSecret,
  encryptSecret,
} from "../../common/utils/encryption.util";
import { OcrConfigDto, OcrConfigPublic } from "./dto/ocr-config.dto";

/**
 * Configuración del motor IA de OCR por tenant.
 *
 * Se guarda en la tabla Configuration (categoría "OCR"): el modelo en claro y
 * la API key cifrada con AES-256-GCM (CONFIG_ENCRYPTION_KEY). Así la config es
 * compartida por todos los dispositivos del tenant: un móvil sin la key en su
 * localStorage sigue usando la IA configurada desde otro dispositivo.
 *
 * resolveForUpload() es el punto que usa AlbaranesService al subir un albarán:
 * prioriza lo que envíe el cliente (backward compat con localStorage) y, si no
 * trae nada, cae a la config guardada.
 */
const OCR_CATEGORY = "OCR";
const KEY_MODEL = "ocr.model";
const KEY_API_KEY = "ocr.api_key";
const SALT = "chefchek-ocr";
const DEFAULT_MODEL = "regex";

@Injectable()
export class OcrConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicConfig(tenantId: string): Promise<OcrConfigPublic> {
    const v = await this.readValues(tenantId);
    return {
      model: v.model || DEFAULT_MODEL,
      hasApiKey: Boolean(v.apiKey),
    };
  }

  async saveConfig(
    tenantId: string,
    dto: OcrConfigDto,
    userId: string,
  ): Promise<OcrConfigPublic> {
    const entries: Array<[string, string]> = [];
    if (dto.model !== undefined) {
      entries.push([KEY_MODEL, dto.model]);
    }
    // apiKey vacía/omitida → conservar la existente (como el password SMTP).
    if (dto.apiKey !== undefined && dto.apiKey !== "") {
      entries.push([KEY_API_KEY, encryptSecret(dto.apiKey, SALT)]);
    }

    if (entries.length) {
      await this.prisma.$transaction(
        entries.map(([key, value]) =>
          this.prisma.configuration.upsert({
            where: { tenantId_key: { tenantId, key } },
            create: {
              tenantId,
              key,
              value,
              category: OCR_CATEGORY,
              description:
                key === KEY_MODEL
                  ? "Modelo IA de extracción de albaranes (ocr)"
                  : "API key del modelo IA de OCR (cifrada)",
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
   * Resuelve el motor IA + API key a aplicar al subir un albarán.
   * Devuelve { aiModel, aiApiKey } solo si hay un modelo distinto de "regex" Y
   * una key disponible; en caso contrario devuelve undefined/undefined para que
   * el microservicio use el path regex (comportamiento por defecto).
   *
   * Orden de prioridad:
   *   1. Lo que envíe el cliente en la petición (backward compat localStorage).
   *   2. La config guardada del tenant.
   */
  async resolveForUpload(
    tenantId: string,
    request?: { aiModel?: string; aiApiKey?: string },
  ): Promise<{ aiModel?: string; aiApiKey?: string }> {
    const stored = await this.readValues(tenantId);
    const reqModel =
      request?.aiModel && request.aiModel !== "regex"
        ? request.aiModel
        : undefined;
    const model =
      reqModel ??
      (stored.model && stored.model !== "regex" ? stored.model : undefined);
    if (!model) {
      return { aiModel: undefined, aiApiKey: undefined };
    }

    const key =
      request?.aiApiKey ||
      (stored.apiKey ? decryptSecret(stored.apiKey, SALT) : undefined);
    if (!key) {
      return { aiModel: undefined, aiApiKey: undefined };
    }

    return { aiModel: model, aiApiKey: key };
  }

  private async readValues(
    tenantId: string,
  ): Promise<{ model?: string; apiKey?: string }> {
    const rows = await this.prisma.configuration.findMany({
      where: { tenantId, key: { in: [KEY_MODEL, KEY_API_KEY] } },
    });
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return { model: byKey[KEY_MODEL], apiKey: byKey[KEY_API_KEY] };
  }
}
