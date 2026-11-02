'use client';

import { Eye, Paperclip } from 'lucide-react';
import type { MailSummary } from '../hooks/use-correo';
import { senderLabel, shortDate } from './mail-format';

interface Props {
  messages: MailSummary[];
  selectedUid: number | null;
  /** En «Enviados» interesa a quién se envió, no quién lo envió. */
  showRecipients: boolean;
  onSelect: (uid: number) => void;
  /** Paginador (tamaño y flechas) que va al pie de la lista. */
  footer: React.ReactNode;
}

/**
 * Tres tonos: sin leer en el buzón → negrita; leído en Outlook/móvil → normal;
 * abierto en ChefChek → apagado, para distinguir lo que ya se ha visto aquí.
 */
function senderTone(m: MailSummary): string {
  if (m.openedInChefchek) return 'text-[var(--on-surface-variant)]';
  return m.seen ? 'text-[var(--on-surface)]' : 'font-bold text-[var(--on-surface)]';
}

function subjectTone(m: MailSummary): string {
  if (m.openedInChefchek) return 'text-[var(--on-surface-variant)] opacity-70';
  return m.seen ? 'text-[var(--on-surface-variant)]' : 'font-semibold text-[var(--on-surface)]';
}

export function MailMessageList({ messages, selectedUid, showRecipients, onSelect, footer }: Props) {
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
                <span className={`truncate text-sm ${senderTone(m)}`}>
                  {showRecipients ? `Para: ${senderLabel(m.to)}` : senderLabel(m.from)}
                </span>
                <span className="flex shrink-0 items-center gap-1 text-xs text-[var(--on-surface-variant)]">
                  {m.openedInChefchek && <Eye className="h-3.5 w-3.5" aria-label="Abierto en ChefChek" />}
                  {shortDate(m.date)}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-1">
                {m.hasAttachments && <Paperclip className="h-3.5 w-3.5 shrink-0 text-[var(--on-surface-variant)]" aria-label="Con adjuntos" />}
                <span className={`truncate text-sm ${subjectTone(m)}`}>
                  {m.subject}
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>
      {footer}
    </div>
  );
}
