import { Injectable, BadGatewayException } from "@nestjs/common";
import {
  ChatMessage,
  ProviderAdapter,
  ProviderChatResult,
  ToolSchema,
} from "./provider-adapter.interface";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_TOKENS = 1024;
// Sin timeout, un fallo de red deja la petición colgada indefinidamente
// (undici's fetch no tiene límite propio) — reproducido en pruebas manuales.
const REQUEST_TIMEOUT_MS = 30000;

/**
 * Adaptador para la Messages API de Anthropic. A diferencia de OpenAI/Gemini,
 * el system prompt va en un campo `system` aparte (no como mensaje), y las
 * tool calls/resultados van como content blocks `tool_use`/`tool_result`.
 */
@Injectable()
export class AnthropicProviderAdapter implements ProviderAdapter {
  async chat(
    apiKey: string,
    model: string,
    messages: ChatMessage[],
    tools: ToolSchema[],
  ): Promise<ProviderChatResult> {
    const systemMessages = messages.filter((m) => m.role === "system");
    const system =
      systemMessages.map((m) => m.content).join("\n\n") || undefined;
    const conversation = messages.filter((m) => m.role !== "system");

    const body = {
      model,
      max_tokens: MAX_TOKENS,
      system,
      messages: this.buildMessages(conversation),
      ...(tools.length
        ? {
            tools: tools.map((t) => ({
              name: t.name,
              description: t.description,
              input_schema: t.parameters,
            })),
          }
        : {}),
    };

    let res: Response;
    try {
      res = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (e: any) {
      throw new BadGatewayException(
        `No se pudo conectar con Anthropic: ${e?.message ?? e}`,
      );
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new BadGatewayException(
        `Anthropic respondió ${res.status}: ${text.slice(0, 300)}`,
      );
    }

    const data: any = await res.json();
    const blocks: any[] = data.content ?? [];

    const textBlocks = blocks
      .filter((b) => b.type === "text")
      .map((b) => b.text);
    const toolUseBlocks = blocks.filter((b) => b.type === "tool_use");

    return {
      content: textBlocks.length ? textBlocks.join("\n") : undefined,
      toolCalls: toolUseBlocks.length
        ? toolUseBlocks.map((b) => ({
            id: b.id,
            name: b.name,
            params: b.input ?? {},
          }))
        : undefined,
    };
  }

  /**
   * Anthropic exige TODOS los tool_result de un turno en un único mensaje
   * role="user" (nunca varios "user" consecutivos) — si el LLM pide 2+ tools
   * en la misma respuesta (parallel tool calling, comportamiento por defecto),
   * el orquestador empuja un ChatMessage role="tool" por cada una; aquí se
   * agrupan las consecutivas en un solo turno antes de mandarlas.
   */
  private buildMessages(conversation: ChatMessage[]): Record<string, any>[] {
    const result: Record<string, any>[] = [];
    let i = 0;
    while (i < conversation.length) {
      if (conversation[i].role === "tool") {
        const content: any[] = [];
        while (i < conversation.length && conversation[i].role === "tool") {
          const t = conversation[i];
          content.push({
            type: "tool_result",
            tool_use_id: t.toolCallId,
            content: t.content,
          });
          i += 1;
        }
        result.push({ role: "user", content });
        continue;
      }
      result.push(this.toAnthropicMessage(conversation[i]));
      i += 1;
    }
    return result;
  }

  private toAnthropicMessage(m: ChatMessage): Record<string, any> {
    if (m.role === "assistant" && m.toolCalls?.length) {
      const content: any[] = [];
      if (m.content) {
        content.push({ type: "text", text: m.content });
      }
      for (const tc of m.toolCalls) {
        content.push({
          type: "tool_use",
          id: tc.id,
          name: tc.name,
          input: tc.params,
        });
      }
      return { role: "assistant", content };
    }
    return { role: m.role, content: m.content };
  }
}
