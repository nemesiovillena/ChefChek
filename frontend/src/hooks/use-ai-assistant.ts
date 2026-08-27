import { useApiQuery, useApiMutation, useInvalidateQueries } from './use-api';

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  createdAt: string;
}

export interface AssistantConversationSummary {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantConversationDetail extends AssistantConversationSummary {
  messages: AssistantMessage[];
}

export interface AskAssistantResult {
  conversationId: string;
  answer: string;
}

const CONVERSATIONS_KEY = ['ai-assistant-conversations'];
const conversationKey = (id: string) => ['ai-assistant-conversation', id];

// El asistente puede encadenar varias llamadas al proveedor de IA (tool-calling
// multi-turno, MAX_TOOL_TURNS=4 en el backend); el timeout global de 30s del
// cliente HTTP (api-client.ts) se queda corto para preguntas que requieren
// varias vueltas, así que esta petición usa uno propio más holgado.
const ASK_TIMEOUT_MS = 90000;

/** Envía una pregunta al asistente Chefchek (síncrono, sin streaming). */
export function useAskAssistant() {
  const invalidateQueries = useInvalidateQueries();
  return useApiMutation<AskAssistantResult, { conversationId?: string; message: string }>(
    '/v1/ai-assistant/ask',
    'POST',
    {
      onSuccess: (data) => {
        invalidateQueries([CONVERSATIONS_KEY, conversationKey(data.conversationId)]);
      },
    },
    { timeout: ASK_TIMEOUT_MS },
  );
}

export function useAssistantConversations() {
  return useApiQuery<AssistantConversationSummary[]>(
    CONVERSATIONS_KEY,
    '/v1/ai-assistant/conversations',
  );
}

export function useAssistantConversation(id: string | undefined) {
  return useApiQuery<AssistantConversationDetail>(
    conversationKey(id ?? 'none'),
    `/v1/ai-assistant/conversations/${id}`,
    { enabled: Boolean(id) },
  );
}
