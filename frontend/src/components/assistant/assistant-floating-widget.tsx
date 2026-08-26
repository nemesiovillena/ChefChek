'use client';

import { useState } from 'react';
import { Bot, X } from 'lucide-react';
import { AssistantChatPanel } from './assistant-chat-panel';

/**
 * Widget flotante global del asistente "Chefchek", montado una vez en
 * dashboard/layout.tsx. Posicionado por encima de la barra de navegación
 * móvil fija (h-16, z-50) — ver z-index de referencia en esa misma barra.
 */
export function AssistantFloatingWidget() {
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();

  return (
    <>
      {open && (
        <div className="fixed bottom-36 right-4 z-40 flex h-[28rem] max-h-[70vh] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-high)] shadow-2xl md:bottom-24">
          <div className="flex items-center justify-between border-b border-[var(--outline-variant)] px-4 py-3">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-[var(--primary)]" />
              <span className="text-sm font-semibold text-[var(--on-surface)]">Chefchek</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              className="rounded-lg p-1 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-low)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <AssistantChatPanel
            conversationId={conversationId}
            onConversationIdChange={setConversationId}
            compact
          />
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Cerrar asistente Chefchek' : 'Abrir asistente Chefchek'}
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)] text-primary-foreground shadow-xl transition-transform hover:scale-105 md:bottom-6"
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </button>
    </>
  );
}
