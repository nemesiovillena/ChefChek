import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { AiAssistantConfigService } from "./config/ai-assistant-config.service";
import { AiAssistantProvider } from "./config/dto/ai-assistant-config.dto";
import { OpenAiProviderAdapter } from "./providers/openai-provider.adapter";
import { GeminiProviderAdapter } from "./providers/gemini-provider.adapter";
import { AnthropicProviderAdapter } from "./providers/anthropic-provider.adapter";
import {
  ChatMessage,
  ChatOptions,
  ProviderAdapter,
  ProviderChatResult,
} from "./providers/provider-adapter.interface";
import { toUserFacingProviderError } from "./provider-error-message.util";

export const AI_NOT_CONFIGURED_MESSAGE =
  "Configura el proveedor de IA en Configuración → Asistente IA (proveedor, modelo y API key).";

/** Fallo de la llamada al proveedor, ya con un mensaje apto para el usuario. */
export class AssistantCompletionError extends Error {}

/**
 * Llamada única a la IA del tenant, sin tools ni conversación: para otros
 * módulos que necesitan que el modelo transforme un contenido (p. ej. captura
 * de recetas). Usa la misma configuración y adaptadores que el chat.
 */
@Injectable()
export class AssistantCompletionService {
  private readonly logger = new Logger(AssistantCompletionService.name);
  private readonly adapters: Record<AiAssistantProvider, ProviderAdapter>;

  constructor(
    private readonly configService: AiAssistantConfigService,
    openai: OpenAiProviderAdapter,
    gemini: GeminiProviderAdapter,
    anthropic: AnthropicProviderAdapter,
  ) {
    this.adapters = { openai, gemini, anthropic };
  }

  /** Lanza 400 con un mensaje accionable si falta proveedor, modelo o clave. */
  async assertConfigured(tenantId: string): Promise<void> {
    const config = await this.configService.resolveForRequest(tenantId);
    if (!config) {
      throw new BadRequestException(AI_NOT_CONFIGURED_MESSAGE);
    }
  }

  async complete(
    tenantId: string,
    messages: ChatMessage[],
    options?: ChatOptions,
  ): Promise<ProviderChatResult> {
    const config = await this.configService.resolveForRequest(tenantId);
    if (!config) {
      throw new AssistantCompletionError(AI_NOT_CONFIGURED_MESSAGE);
    }
    try {
      return await this.adapters[config.provider].chat(
        config.apiKey,
        config.model,
        messages,
        [],
        options,
      );
    } catch (e: any) {
      // Proveedor y modelo sí; nunca la API key ni el contenido enviado.
      this.logger.error(
        `complete falló (provider=${config.provider}, model=${config.model}): ${e?.message ?? e}`,
        e?.stack,
      );
      throw new AssistantCompletionError(toUserFacingProviderError(e));
    }
  }
}
