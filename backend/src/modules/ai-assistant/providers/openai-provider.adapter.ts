import { Injectable, BadGatewayException } from "@nestjs/common";
import {
  ChatMessage,
  ProviderAdapter,
  ProviderChatResult,
  ToolSchema,
} from "./provider-adapter.interface";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
// Sin timeout, un fallo de red deja la petición colgada indefinidamente
// (undici's fetch no tiene límite propio) — reproducido en pruebas manuales.
const REQUEST_TIMEOUT_MS = 30000;

/** Adaptador para la Chat Completions API de OpenAI (tool calling). */
@Injectable()
export class OpenAiProviderAdapter implements ProviderAdapter {
  async chat(
    apiKey: string,
    model: string,
    messages: ChatMessage[],
    tools: ToolSchema[],
  ): Promise<ProviderChatResult> {
    const body = {
      model,
      messages: messages.map((m) => this.toOpenAiMessage(m)),
      ...(tools.length
        ? {
            tools: tools.map((t) => ({
              type: "function",
              function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters,
              },
            })),
            tool_choice: "auto",
          }
        : {}),
    };

    let res: Response;
    try {
      res = await fetch(OPENAI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (e: any) {
      throw new BadGatewayException(
        `No se pudo conectar con OpenAI: ${e?.message ?? e}`,
      );
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new BadGatewayException(
        `OpenAI respondió ${res.status}: ${text.slice(0, 300)}`,
      );
    }

    const data: any = await res.json();
    const message = data.choices?.[0]?.message;
    if (!message) {
      throw new BadGatewayException("Respuesta de OpenAI sin contenido");
    }

    const toolCalls = (message.tool_calls ?? []).map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      params: this.parseArguments(tc.function.arguments),
    }));

    return {
      content: message.content ?? undefined,
      toolCalls: toolCalls.length ? toolCalls : undefined,
    };
  }

  private parseArguments(raw: string): Record<string, any> {
    try {
      return JSON.parse(raw || "{}");
    } catch {
      return {};
    }
  }

  private toOpenAiMessage(m: ChatMessage): Record<string, any> {
    if (m.role === "tool") {
      return { role: "tool", tool_call_id: m.toolCallId, content: m.content };
    }
    if (m.role === "assistant" && m.toolCalls?.length) {
      return {
        role: "assistant",
        content: m.content || null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: JSON.stringify(tc.params) },
        })),
      };
    }
    return { role: m.role, content: m.content };
  }
}
