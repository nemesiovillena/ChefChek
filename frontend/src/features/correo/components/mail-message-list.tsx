'use client';

import { Loader2, Paperclip } from 'lucide-react';
import type { MailSummary } from '../hooks/use-correo';
import { senderLabel, shortDate } from './mail-format';

interface Props {
  messages: MailSummary[];
  selectedUid: number | null;
  /** En «Enviados» interesa a quién se envió, no quién lo envió. */
  showRecipients: boolean;
  onSelect: (uid: number) => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

export function MailMessageList({ messages, selectedUid, showRecipients, onSelect, hasMore, loadingMore, onLoadMore }: Props) {
  if (messages.length === 0) {
    return <p className="p-6 text-center text-sm text-[var(--on-surface-variant)]">No hay correos en esta carpeta.</p>;
  }
  return (
    <div>
      <ul className="divide-y divide-[var(--outline-variant)]">
        {messages.map((m) => (
          <li key={m.uid}>
            <button
              type="button"
              onClick={() => onSelect(m.uid)}
              className={`block w-full px-3 py-3 text-left ${
                selectedUid === m.uid ? 'bg-[var(--surface-container-high)]' : 'hover:bg-[var(--surface-container)]'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className={`truncate text-sm ${m.seen ? 'text-[var(--on-surface)]' : 'font-bold text-[var(--on-surface)]'}`}>
                  {showRecipients ? `Para: ${senderLabel(m.to)}` : senderLabel(m.from)}
                </span>
                <span className="shrink-0 text-xs text-[var(--on-surface-variant)]">{shortDate(m.date)}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-1">
                {m.hasAttachments && <Paperclip className="h-3.5 w-3.5 shrink-0 text-[var(--on-surface-variant)]" aria-label="Con adjuntos" />}
                <span className={`truncate text-sm ${m.seen ? 'text-[var(--on-surface-variant)]' : 'font-semibold text-[var(--on-surface)]'}`}>
                  {m.subject}
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 text-sm font-medium text-[var(--primary)] disabled:opacity-50"
        >
          {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
          Cargar más
        </button>
      )}
    </div>
  );
}
