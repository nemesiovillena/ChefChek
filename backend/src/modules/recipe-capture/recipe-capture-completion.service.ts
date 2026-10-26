import { BadRequestException, Injectable } from "@nestjs/common";
import {
  AssistantCompletionError,
  AssistantCompletionService,
} from "../ai-assistant/assistant-completion.service";
import { ASSISTANT_SETTINGS_LOCATION } from "../ai-assistant/provider-error-message.util";
import { AiAssistantConfigService } from "../ai-assistant/config/ai-assistant-config.service";
import { AiAssistantConfigResolved } from "../ai-assistant/config/dto/ai-assistant-config.dto";
import {
  ChatMessage,
  ChatOptions,
  ProviderChatResult,
} from "../ai-assistant/providers/provider-adapter.interface";
import { RecipeCaptureConfigService } from "./config/recipe-capture-config.service";

export const RECIPE_CAPTURE_SETTINGS_LOCATION =
  "Configuración → Captura de recetas";

export const RECIPE_CAPTURE_NOT_CONFIGURED_MESSAGE =
  "Configura el modelo de IA de la captura de recetas en Configuración → Captura de recetas (proveedor, modelo y API key).";

/**
 * Llamada a la IA para la Captura de recetas. Usa la config propia del módulo
 * (Configuración → Captura de recetas) y, si no hay ninguna, cae a la del
 * Asistente IA para no romper a quien ya la tenía configurada. La resolución
 * vive aquí, en un solo sitio, para que estructuración y validación usen la
 * misma config efectiva.
 */
@Injectable()
export class RecipeCaptureCompletionService {
  constructor(
    private readonly captureConfig: RecipeCaptureConfigService,
    private readonly assistantConfig: AiAssistantConfigService,
    private readonly completion: AssistantCompletionService,
  ) {}

  /** Config efectiva (la de captura o, como respaldo, la del asistente) y la
   *  pantalla donde se cambia. */
  private async resolveWithLocation(
    tenantId: string,
  ): Promise<{ config: AiAssistantConfigResolved; location: string } | null> {
    const own = await this.captureConfig.resolveForRequest(tenantId);
    if (own) {
      return { config: own, location: RECIPE_CAPTURE_SETTINGS_LOCATION };
    }
    const fallback = await this.assistantConfig.resolveForRequest(tenantId);
    return fallback
      ? { config: fallback, location: ASSISTANT_SETTINGS_LOCATION }
      : null;
  }

  /** Lanza 400 con un mensaje accionable si no hay IA utilizable. */
  async assertConfigured(tenantId: string): Promise<void> {
    if (!(await this.resolveWithLocation(tenantId))) {
      throw new BadRequestException(RECIPE_CAPTURE_NOT_CONFIGURED_MESSAGE);
    }
  }

  async complete(
    tenantId: string,
    messages: ChatMessage[],
    options?: ChatOptions,
  ): Promise<ProviderChatResult> {
    const resolved = await this.resolveWithLocation(tenantId);
    if (!resolved) {
      throw new AssistantCompletionError(RECIPE_CAPTURE_NOT_CONFIGURED_MESSAGE);
    }
    return this.completion.completeWith(
      resolved.config,
      messages,
      options,
      resolved.location,
    );
  }
}
