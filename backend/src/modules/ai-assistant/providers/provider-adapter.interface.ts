/** Formato común de mensaje, normalizado entre proveedores. */
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  /** Solo en mensajes role="tool": a qué llamada responde. */
  toolCallId?: string;
  /** Solo en mensajes role="tool": nombre de la tool ejecutada (Gemini lo necesita explícito, no basta el id). */
  toolName?: string;
  /** Solo en mensajes role="assistant" que piden ejecutar tools. */
  toolCalls?: Array<{ id: string; name: string; params: Record<string, any> }>;
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<
      string,
      { type: string; description: string; enum?: string[] }
    >;
    required?: string[];
  };
}

export interface ProviderChatResult {
  content?: string;
  toolCalls?: Array<{ id: string; name: string; params: Record<string, any> }>;
}

/**
 * Adaptador fino por proveedor (OpenAI/Gemini/Anthropic), vía `fetch` nativo
 * en vez de SDKs — cada proveedor es una llamada HTTP simple, no justifica
 * 3 dependencias nuevas (YAGNI). Cada adaptador traduce `ChatMessage[]`/
 * `ToolSchema[]` al formato propio de su API y normaliza la respuesta.
 */
export interface ProviderAdapter {
  chat(
    apiKey: string,
    model: string,
    messages: ChatMessage[],
    tools: ToolSchema[],
  ): Promise<ProviderChatResult>;
}
