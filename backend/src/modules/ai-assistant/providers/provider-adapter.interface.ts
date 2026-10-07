export interface ToolCall {
  id: string;
  name: string;
  params: Record<string, any>;
  /**
   * Solo Gemini 3.x ("thinking" models): firma opaca que la API devuelve junto
   * a cada functionCall y EXIGE recibir de vuelta sin modificar en el turno
   * siguiente ("Function call is missing a thought_signature..." 400 si no se
   * reenvía). Los demás proveedores la ignoran sin problema.
   */
  thoughtSignature?: string;
}

/** Formato común de mensaje, normalizado entre proveedores. */
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  /** Solo en mensajes role="tool": a qué llamada responde. */
  toolCallId?: string;
  /** Solo en mensajes role="tool": nombre de la tool ejecutada (Gemini lo necesita explícito, no basta el id). */
  toolName?: string;
  /** Solo en mensajes role="assistant" que piden ejecutar tools. */
  toolCalls?: ToolCall[];
  /** Solo en mensajes role="user": imágenes o PDF que el modelo debe leer. */
  attachments?: ChatAttachment[];
}

export interface ChatAttachment {
  /** image/jpeg, image/png, image/webp o application/pdf. */
  mimeType: string;
  dataBase64: string;
}

/**
 * Ajustes por llamada. Sin ellos cada adaptador se comporta como en el chat
 * (respuesta corta, 30 s, con reintentos); los necesita quien pide una salida
 * larga o envía adjuntos pesados.
 */
export interface ChatOptions {
  maxOutputTokens?: number;
  timeoutMs?: number;
  /** Pide JSON válido como salida donde el proveedor lo admite. */
  jsonMode?: boolean;
  /** No reenviar la petición si falla (cuerpos grandes, llamadas caras). */
  noRetry?: boolean;
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
  toolCalls?: ToolCall[];
  /** true si el proveedor cortó la respuesta al llegar al tope de tokens. */
  truncated?: boolean;
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
    options?: ChatOptions,
  ): Promise<ProviderChatResult>;
}
