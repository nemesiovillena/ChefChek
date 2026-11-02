'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, Paperclip, Send, X } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { isUncertainSendError, MAX_UPLOAD_BYTES, useSendMail } from '../hooks/use-correo';
import type { ComposeDraft } from '../lib/mail-compose-prefill';
import { fileSize } from './mail-format';

const TITLES = { new: 'Nuevo correo', reply: 'Responder', replyAll: 'Responder a todos', forward: 'Reenviar' };
const fieldCls =
  'min-h-[44px] w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-base text-[var(--on-surface)]';

/** Redactar, responder o reenviar. El servidor cita el original y guarda la copia en Enviados. */
export function MailComposeDialog({ draft, onClose }: { draft: ComposeDraft; onClose: () => void }) {
  const notify = useNotification();
  const send = useSendMail();
  const [to, setTo] = useState(draft.to);
  const [cc, setCc] = useState(draft.cc);
  const [bcc, setBcc] = useState('');
  const [showCopies, setShowCopies] = useState(!!draft.cc);
  const [subject, setSubject] = useState(draft.subject);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const tooBig = totalSize > MAX_UPLOAD_BYTES;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!to.trim()) {
      notify({ type: 'error', title: 'Falta el destinatario', message: 'Escribe al menos una dirección en «Para».' });
      return;
    }
    try {
      const res = await send.mutateAsync({ mode: draft.mode, to, cc, bcc, subject, text, ref: draft.ref, files });
      notify(
        res.savedToSent
          ? { type: 'success', title: 'Correo enviado', message: '' }
          : { type: 'warning', title: 'Correo enviado', message: 'No se pudo guardar la copia en «Enviados». No lo vuelvas a enviar.' },
      );
      onClose();
    } catch (err) {
      if (isUncertainSendError(err)) {
        notify({
          type: 'warning',
          title: 'Puede que se haya enviado',
          message: 'Se perdió la conexión mientras se enviaba. Revisa «Enviados» antes de volver a enviarlo.',
        });
        return;
      }
      notify({ type: 'error', title: 'No se envió', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 p-4 pb-28 md:pb-4">
      <form
        onSubmit={handleSubmit}
        className="mt-4 w-full max-w-2xl space-y-3 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold text-[var(--on-surface)]">{TITLES[draft.mode]}</div>
          <button type="button" aria-label="Cerrar" onClick={onClose} disabled={send.isPending} className="p-2">
            <X className="h-5 w-5" />
          </button>
        </div>
        <input aria-label="Para" placeholder="Para" value={to} onChange={(e) => setTo(e.target.value)} className={fieldCls} />
        {showCopies ? (
          <>
            <input aria-label="CC" placeholder="CC" value={cc} onChange={(e) => setCc(e.target.value)} className={fieldCls} />
            <input aria-label="CCO" placeholder="CCO (copia oculta)" value={bcc} onChange={(e) => setBcc(e.target.value)} className={fieldCls} />
          </>
        ) : (
          <button type="button" onClick={() => setShowCopies(true)} className="text-sm text-[var(--primary)]">
            Añadir CC / CCO
          </button>
        )}
        <input aria-label="Asunto" placeholder="Asunto" value={subject} onChange={(e) => setSubject(e.target.value)} className={fieldCls} />
        <textarea
          aria-label="Mensaje"
          placeholder="Escribe tu mensaje…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          className={`${fieldCls} py-2`}
        />
        {draft.mode !== 'new' && (
          <p className="text-xs text-[var(--on-surface-variant)]">
            {draft.mode === 'forward'
              ? `Se añadirá el correo original${draft.forwardedAttachments ? ` y sus ${draft.forwardedAttachments} adjunto(s)` : ''}.`
              : 'Se añadirá el correo original citado debajo de tu mensaje.'}
          </p>
        )}
        <div className="space-y-2">
          <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-[var(--primary)]">
            <Paperclip className="h-4 w-4" /> Adjuntar archivos
            <input
              type="file"
              multiple
              className="sr-only"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []);
                e.target.value = '';
                setFiles((prev) => [...prev, ...picked]);
              }}
            />
          </label>
          {files.length > 0 && (
            <ul className="space-y-1 text-sm">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-lg bg-[var(--surface-container)] px-3 py-1">
                  <span className="truncate">{f.name}</span>
                  <span className="flex items-center gap-2 text-xs text-[var(--on-surface-variant)]">
                    {fileSize(f.size)}
                    <button type="button" aria-label={`Quitar ${f.name}`} onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}>
                      <X className="h-4 w-4" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {tooBig && <p className="text-sm text-[var(--error)]">Los adjuntos superan 10 MB ({fileSize(totalSize)}).</p>}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={send.isPending} className="min-h-[44px] rounded-xl border border-[var(--outline-variant)] px-4 text-sm">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={send.isPending || tooBig}
            className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar
          </button>
        </div>
      </form>
    </div>
  );
}
