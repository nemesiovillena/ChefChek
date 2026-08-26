'use client';

import { useState } from 'react';
import { Bot, Loader2, Plus } from 'lucide-react';
import { AssistantChatPanel } from '@/components/assistant/assistant-chat-panel';
import { useAssistantConversations } from '@/hooks/use-ai-assistant';

export default function AsistentePage() {
  const { data: conversations, isLoading } = useAssistantConversations();
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  return (
    <div className="px-margin-mobile md:px-margin-desktop max-w-container-max-width mx-auto pb-24 pt-8">
      <div className="mb-stack-xl">
        <span className="font-label-md text-label-md text-secondary tracking-widest uppercase">Herramientas</span>
        <h2 className="font-headline-lg text-headline-lg text-primary mt-stack-xs flex items-center gap-2">
          <Bot className="h-6 w-6" />
          Asistente Chefchek
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Pregúntale en lenguaje natural sobre precios, compras, recetas y stock.
        </p>
      </div>

      <div className="tonal-layer-2 grid grid-cols-1 overflow-hidden rounded-xl border border-border md:grid-cols-[16rem_1fr]">
        <aside className="border-b border-border md:border-b-0 md:border-r">
          <button
            onClick={() => setSelectedId(undefined)}
            className="flex w-full items-center gap-2 border-b border-border px-4 py-3 text-left text-sm font-medium text-primary hover:bg-surface-variant"
          >
            <Plus className="h-4 w-4" />
            Nueva conversación
          </button>
          <div className="max-h-64 overflow-y-auto md:max-h-[32rem]">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-secondary" />
              </div>
            ) : !conversations || conversations.length === 0 ? (
              <p className="p-4 text-sm text-on-surface-variant">Todavía no has hablado con Chefchek.</p>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`block w-full truncate px-4 py-3 text-left text-sm hover:bg-surface-variant ${
                    selectedId === c.id ? 'bg-surface-variant font-medium text-primary' : 'text-on-surface'
                  }`}
                >
                  {c.title || 'Conversación sin título'}
                </button>
              ))
            )}
          </div>
        </aside>

        <div className="h-[32rem]">
          <AssistantChatPanel
            key={selectedId ?? 'new'}
            conversationId={selectedId}
            onConversationIdChange={setSelectedId}
          />
        </div>
      </div>
    </div>
  );
}
