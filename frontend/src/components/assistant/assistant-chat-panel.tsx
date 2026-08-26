'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bot, Loader2, Send, User } from 'lucide-react';
import { useAskAssistant, useAssistantConversation } from '@/hooks/use-ai-assistant';

interface LocalMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface AssistantChatPanelProps {
  conversationId?: string;
  onConversationIdChange?: (id: string) => void;
  /** Panel compacto (widget flotante) vs a pantalla completa (página dedicada). */
  compact?: boolean;
}

const NO_CONFIG_MARKER = 'proveedor de IA configurado';
let localIdCounter = 0;

/**
 * Panel de conversación compartido entre el widget flotante y la página
 * dedicada /dashboard/asistente. Mensajes role="tool" del backend nunca se
 * muestran (son detalle interno de la ejecución de tools).
 */
export function AssistantChatPanel({
  conversationId,
  onConversationIdChange,
  compact = false,
}: AssistantChatPanelProps) {
  const { data: conversation } = useAssistantConversation(conversationId);
  const askMut = useAskAssistant();
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Al cambiar de conversación (o cargarla por primera vez), sincroniza el
  // historial visible desde el backend, filtrando los mensajes role="tool".
  useEffect(() => {
    if (!conversation) return;
    setMessages(
      conversation.messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content })),
    );
  }, [conversation]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, askMut.isPending]);

  const handleSend = async () => {
    const message = input.trim();
    if (!message || askMut.isPending) return;

    localIdCounter += 1;
    const userMsg: LocalMessage = { id: `local-${localIdCounter}`, role: 'user', content: message };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    try {
      const result = await askMut.mutateAsync({ conversationId, message });
      localIdCounter += 1;
      setMessages((prev) => [
        ...prev,
        { id: `local-${localIdCounter}`, role: 'assistant', content: result.answer },
      ]);
      if (!conversationId && result.conversationId) {
        onConversationIdChange?.(result.conversationId);
      }
    } catch (e) {
      localIdCounter += 1;
      setMessages((prev) => [
        ...prev,
        {
          id: `local-${localIdCounter}`,
          role: 'assistant',
          content: e instanceof Error ? e.message : 'No he podido responder, inténtalo de nuevo.',
        },
      ]);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div
        ref={scrollRef}
        className={`flex-1 space-y-3 overflow-y-auto ${compact ? 'p-3' : 'p-4'}`}
      >
        {messages.length === 0 && (
          <p className="text-sm italic text-[var(--on-surface-variant)]">
            ¡Hola! Soy Chefchek. Pregúntame cosas como &quot;¿quién me ha subido precios este
            mes?&quot; o &quot;¿qué producto se compró más la última semana?&quot;.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex items-start gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--primary-container)] text-[var(--on-primary-container)]">
              {m.role === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
            </div>
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-[var(--primary)] text-primary-foreground'
                  : 'bg-[var(--surface-container-low)] text-[var(--on-surface)]'
              }`}
            >
              {m.content}
              {m.role === 'assistant' && m.content.includes(NO_CONFIG_MARKER) && (
                <Link
                  href="/dashboard/settings"
                  className="mt-2 block text-xs font-semibold underline underline-offset-2"
                >
                  Ir a Ajustes →
                </Link>
              )}
            </div>
          </div>
        ))}
        {askMut.isPending && (
          <div className="flex items-center gap-2 text-xs text-[var(--on-surface-variant)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Chefchek está pensando…
          </div>
        )}
      </div>

      <div className={`flex items-center gap-2 border-t border-[var(--outline-variant)] ${compact ? 'p-2' : 'p-3'}`}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Pregúntale algo a Chefchek…"
          className="w-full rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm text-[var(--on-surface)] outline-none focus:border-[var(--primary)]"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || askMut.isPending}
          aria-label="Enviar"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-primary-foreground disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
