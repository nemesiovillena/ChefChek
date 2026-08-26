import { Injectable, BadGatewayException } from "@nestjs/common";
import {
  ChatMessage,
  ProviderAdapter,
  ProviderChatResult,
  ToolSchema,
} from "./provider-adapter.interface";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
// Sin timeout, un fallo de red deja la petición colgada indefinidamente
// (undici's fetch no tiene límite propio) — reproducido en pruebas manuales.
const REQUEST_TIMEOUT_MS = 30000;

/**
 * Adaptador para la Generative Language API de Gemini. Roles distintos
 * (user/model, no user/assistant), system aparte (`systemInstruction`), y
 * tool calls/resultados como `functionCall`/`functionResponse` parts.
 */
@Injectable()
export class GeminiProviderAdapter implements ProviderAdapter {
  async chat(
    apiKey: string,
    model: string,
    messages: ChatMessage[],
    tools: ToolSchema[],
  ): Promise<ProviderChatResult> {
    const systemMessages = messages.filter((m) => m.role === "system");
    const systemInstruction = systemMessages.length
      ? { parts: [{ text: systemMessages.map((m) => m.content).join("\n\n") }] }
      : undefined;
    const conversation = messages.filter((m) => m.role !== "system");

    const body = {
      contents: this.buildContents(conversation),
      ...(systemInstruction ? { systemInstruction } : {}),
      ...(tools.length
        ? {
            tools: [
              {
                functionDeclarations: tools.map((t) => ({
                  name: t.name,
                  description: t.description,
                  parameters: t.parameters,
                })),
              },
            ],
          }
        : {}),
    };

    const url = `${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (e: any) {
      throw new BadGatewayException(
        `No se pudo conectar con Gemini: ${e?.message ?? e}`,
      );
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new BadGatewayException(
        `Gemini respondió ${res.status}: ${text.slice(0, 300)}`,
      );
    }

    const data: any = await res.json();
    const parts: any[] = data.candidates?.[0]?.content?.parts ?? [];

    const textParts = parts.filter((p) => p.text).map((p) => p.text);
    const functionCalls = parts.filter((p) => p.functionCall);

    return {
      content: textParts.length ? textParts.join("\n") : undefined,
      toolCalls: functionCalls.length
        ? functionCalls.map((p, i) => ({
            id: `${p.functionCall.name}-${i}`,
            name: p.functionCall.name,
            params: p.functionCall.args ?? {},
            // Gemini 3.x exige reenviar esto tal cual en el siguiente turno
            // (400 "Function call is missing a thought_signature..." si no).
            thoughtSignature: p.thoughtSignature,
          }))
        : undefined,
    };
  }

  /**
   * Gemini rechaza dos turnos consecutivos del mismo role cuando uno lleva
   * functionResponse ("function response turn comes immediately after a
   * function call turn") — si el LLM pide 2+ tools en la misma respuesta
   * (parallel tool calling, comportamiento por defecto), el orquestador
   * empuja un ChatMessage role="tool" por cada una; aquí se agrupan las
   * consecutivas en un solo turno role="user" antes de mandarlas.
   */
  private buildContents(conversation: ChatMessage[]): Record<string, any>[] {
    const result: Record<string, any>[] = [];
    let i = 0;
    while (i < conversation.length) {
      if (conversation[i].role === "tool") {
        const parts: any[] = [];
        while (i < conversation.length && conversation[i].role === "tool") {
          const t = conversation[i];
          parts.push({
            functionResponse: {
              name: t.toolName ?? "tool",
              response: { result: t.content },
            },
          });
          i += 1;
        }
        result.push({ role: "user", parts });
        continue;
      }
      result.push(this.toGeminiContent(conversation[i]));
      i += 1;
    }
    return result;
  }

  private toGeminiContent(m: ChatMessage): Record<string, any> {
    if (m.role === "assistant" && m.toolCalls?.length) {
      return {
        role: "model",
        parts: m.toolCalls.map((tc) => ({
          functionCall: { name: tc.name, args: tc.params },
          ...(tc.thoughtSignature
            ? { thoughtSignature: tc.thoughtSignature }
            : {}),
        })),
      };
    }
    return {
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    };
  }
}
