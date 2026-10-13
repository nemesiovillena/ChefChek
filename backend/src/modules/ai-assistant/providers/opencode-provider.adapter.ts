import { Injectable } from "@nestjs/common";
import { OpenAiProviderAdapter } from "./openai-provider.adapter";

const OPENCODE_URL = "https://opencode.ai/zen/v1/chat/completions";

/**
 * Adaptador para OpenCode Zen (https://opencode.ai/zen), el gateway de modelos
 * de OpenCode. Expone una API compatible con la Chat Completions de OpenAI
 * (`/chat/completions`), así que reutiliza toda la traducción de mensajes,
 * tools y adjuntos del adaptador de OpenAI; solo cambia la URL y la etiqueta
 * del proveedor (para los mensajes de error).
 */
@Injectable()
export class OpenCodeProviderAdapter extends OpenAiProviderAdapter {
  protected readonly url: string = OPENCODE_URL;
  protected readonly providerLabel: string = "OpenCode Zen";
}
