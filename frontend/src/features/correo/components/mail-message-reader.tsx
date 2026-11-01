'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, Forward, ImageIcon, Loader2, Reply, ReplyAll } from 'lucide-react';
import type { MailDetail, SendMode } from '../hooks/use-correo';
import { buildMailSrcdoc, hasBlockedImages } from '../lib/build-mail-srcdoc';
import { MailAttachmentList } from './mail-attachment-list';
import { fullAddresses, longDate } from './mail-format';

interface Props {
  detail: MailDetail | undefined;
  loading: boolean;
  error: string | null;
  canSend: boolean;
  onBack: () => void;
  onCompose: (mode: SendMode, detail: MailDetail) => void;
}

const actionBtn =
  'flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[var(--outline-variant)] px-3 text-sm hover:bg-[var(--surface-container-high)]';

/**
 * Lector: el cuerpo va en un iframe `sandbox` sin `allow-scripts` ni
 * `allow-same-origin`; solo se permiten ventanas nuevas para los enlaces.
 */
export function MailMessageReader({ detail, loading, error, canSend, onBack, onCompose }: Props) {
  // Se reinicia al cambiar de correo (la clave del componente es el uid)
  const [showImages, setShowImages] = useState(false);
  const srcdoc = useMemo(
    () => (detail ? buildMailSrcdoc({ html: detail.html, text: detail.text }, { showImages }) : ''),
    [detail, showImages],
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 p-6 text-[var(--on-surface-variant)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Abriendo correo…
      </div>
    );
  }
  if (error) return <p className="p-6 text-sm text-[var(--error)]">{error}</p>;
  if (!detail) {
    return <p className="hidden p-6 text-center text-sm text-[var(--on-surface-variant)] lg:block">Elige un correo para leerlo.</p>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-[var(--outline-variant)] p-3">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-[var(--primary)] lg:hidden">
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
        <div className="text-lg font-semibold text-[var(--on-surface)]">{detail.subject}</div>
        <dl className="grid grid-cols-[auto,1fr] gap-x-2 text-sm text-[var(--on-surface-variant)]">
          <dt>De:</dt>
          <dd className="break-all text-[var(--on-surface)]">{fullAddresses(detail.from)}</dd>
          <dt>Para:</dt>
          <dd className="break-all">{fullAddresses(detail.to)}</dd>
          {detail.cc.length > 0 && (
            <>
              <dt>CC:</dt>
              <dd className="break-all">{fullAddresses(detail.cc)}</dd>
            </>
          )}
          <dt>Fecha:</dt>
          <dd>{longDate(detail.date)}</dd>
        </dl>
        <div className="flex flex-wrap gap-2">
          {canSend && (
            <>
              <button type="button" className={actionBtn} onClick={() => onCompose('reply', detail)}>
                <Reply className="h-4 w-4" /> Responder
              </button>
              <button type="button" className={actionBtn} onClick={() => onCompose('replyAll', detail)}>
                <ReplyAll className="h-4 w-4" /> Responder a todos
              </button>
              <button type="button" className={actionBtn} onClick={() => onCompose('forward', detail)}>
                <Forward className="h-4 w-4" /> Reenviar
              </button>
            </>
          )}
          {!showImages && hasBlockedImages(detail.html) && (
            <button type="button" className={actionBtn} onClick={() => setShowImages(true)}>
              <ImageIcon className="h-4 w-4" /> Mostrar imágenes
            </button>
          )}
        </div>
      </div>
      {detail.tooLarge ? (
        <p className="p-4 text-sm text-[var(--on-surface-variant)]">
          Este correo es muy grande para mostrarlo aquí. Puedes descargar sus adjuntos o abrirlo en el webmail.
        </p>
      ) : (
        <iframe
          title="Contenido del correo"
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
          srcDoc={srcdoc}
          className="min-h-[60vh] w-full flex-1 bg-white"
        />
      )}
      <MailAttachmentList detail={detail} />
    </div>
  );
}
