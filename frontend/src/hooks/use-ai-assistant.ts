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
