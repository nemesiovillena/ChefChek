'use client';

import { useState } from 'react';
import { Download, Eye, Loader2, X } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { downloadMailPart, isPreviewableImage, previewMailImage, type MailDetail } from '../hooks/use-correo';
import { fileSize } from './mail-format';

/**
 * Adjuntos: siempre se descargan como archivo (nunca se abren en una pestaña).
 * Solo las imágenes png/jpeg/gif/webp tienen vista previa, dentro de un <img>.
 */
export function MailAttachmentList({ detail }: { detail: MailDetail }) {
  const notify = useNotification();
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const attachments = detail.attachments.filter((a) => !a.inline || !isPreviewableImage(a.contentType));
  if (attachments.length === 0) return null;

  async function run(part: string, action: () => Promise<void>) {
    setBusy(part);
    try {
      await action();
    } catch (err) {
      notify({ type: 'error', title: 'No se pudo abrir el adjunto', message: err instanceof Error ? err.message : '' });
    } finally {
      setBusy(null);
    }
  }

  const closePreview = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  return (
    <div className="border-t border-[var(--outline-variant)] p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--on-surface-variant)]">
        Adjuntos ({attachments.length})
      </p>
      <ul className="flex flex-wrap gap-2">
        {attachments.map((a) => (
          <li key={a.part} className="flex items-center gap-1 rounded-lg border border-[var(--outline-variant)] pl-3 text-sm">
            <span className="max-w-[14rem] truncate" title={a.filename}>{a.filename}</span>
            <span className="text-xs text-[var(--on-surface-variant)]">{fileSize(a.size)}</span>
            {isPreviewableImage(a.contentType) && (
              <button
                type="button"
                aria-label={`Ver ${a.filename}`}
                className="flex h-10 w-10 items-center justify-center"
                onClick={() =>
                  run(a.part, async () =>
                    setPreview({ url: await previewMailImage(detail.folder, detail.uid, detail.uidValidity, a), name: a.filename }),
                  )
                }
              >
                <Eye className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              aria-label={`Descargar ${a.filename}`}
              className="flex h-10 w-10 items-center justify-center"
              onClick={() => run(a.part, () => downloadMailPart(detail.folder, detail.uid, detail.uidValidity, a))}
            >
              {busy === a.part ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            </button>
          </li>
        ))}
      </ul>
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 pb-28 md:pb-4" onClick={closePreview}>
          <button type="button" aria-label="Cerrar" className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white" onClick={closePreview}>
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- blob local, no optimizable */}
          <img src={preview.url} alt={preview.name} className="max-h-full max-w-full rounded-lg bg-white" />
        </div>
      )}
    </div>
  );
}
