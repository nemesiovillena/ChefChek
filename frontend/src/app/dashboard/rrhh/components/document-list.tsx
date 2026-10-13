'use client';

import { Check, FileText, Trash2 } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useConfirm } from '@/contexts/confirm.context';
import { openEmployeeDocument, useAckDocument, useRemoveEmployeeDocument } from '@/hooks/use-rrhh';
import { DOCUMENT_CATEGORY_LABELS, type EmployeeDocument } from '@/lib/rrhh-types';
import { errorMessage, primaryBtnCls, secondaryBtnCls } from '../../check-in/components/check-in-form-styles';

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { timeZone: 'UTC' });
const badge = 'rounded-full px-2 py-0.5 text-xs font-medium';

function DocumentRow({ document, scope }: { document: EmployeeDocument; scope: 'own' | 'team' }) {
  const notify = useNotification();
  const confirm = useConfirm();
  const ack = useAckDocument();
  const remove = useRemoveEmployeeDocument();
  const fail = (err: unknown) => notify({ type: 'error', title: 'Error', message: errorMessage(err) });

  function handleOpen() {
    openEmployeeDocument(scope, document, () =>
      notify({ type: 'error', title: 'El navegador bloqueó la ventana', message: 'Permite las ventanas emergentes para abrir el documento.' }),
    ).catch(fail);
  }

  async function handleAck() {
    const ok = await confirm({
      title: 'Confirmar lectura',
      description: `Queda registrado, con fecha y hora, que has leído «${document.title}». No se puede deshacer.`,
    });
    if (!ok) return;
    try {
      await ack.mutateAsync(document.id);
    } catch (err) {
      fail(err);
    }
  }

  async function handleRemove() {
    const ok = await confirm({
      title: 'Retirar documento',
      description: `«${document.title}» dejará de verse en la ficha de ${document.employeeName}.`,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(document.id);
    } catch (err) {
      fail(err);
    }
  }

  const pendingAck = document.requiresAck && !document.ackAt;
  return (
    <li className="space-y-2 py-3">
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{document.title}</span>
        <span className={`${badge} bg-[var(--surface-container-high)]`}>{DOCUMENT_CATEGORY_LABELS[document.category]}</span>
        {document.expiryStatus === 'EXPIRED' && <span className={`${badge} bg-[var(--error)] text-[var(--on-error)]`}>Caducado</span>}
        {document.expiryStatus === 'EXPIRING' && <span className={`${badge} bg-amber-500 text-black`}>Caduca pronto</span>}
        {pendingAck && <span className={`${badge} bg-amber-500 text-black`}>Pendiente de leer</span>}
        {document.ackAt && <span className={`${badge} bg-emerald-600 text-white`}>Leído el {shortDate(document.ackAt)}</span>}
      </p>
      <p className="text-sm text-[var(--on-surface-variant)]">
        {scope === 'team' && `${document.employeeName} · `}
        {document.uploadedByEmployee ? 'Subido por su titular' : `Subido por ${document.uploadedByName}`} el {shortDate(document.createdAt)}
        {document.expiresAt && ` · caduca el ${shortDate(document.expiresAt)}`}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={handleOpen} className={secondaryBtnCls}>
          <FileText className="h-4 w-4" /> Abrir
        </button>
        {scope === 'own' && pendingAck && (
          <button type="button" onClick={handleAck} disabled={ack.isPending} className={primaryBtnCls}>
            <Check className="h-4 w-4" /> He leído este documento
          </button>
        )}
        {scope === 'team' && !document.ackAt && (
          <button type="button" onClick={handleRemove} disabled={remove.isPending} className={secondaryBtnCls}>
            <Trash2 className="h-4 w-4" /> Retirar
          </button>
        )}
      </div>
    </li>
  );
}

/** Lista de documentos laborales: `own` para su titular, `team` para gerencia. */
export function DocumentList({ documents, scope, empty }: { documents: EmployeeDocument[]; scope: 'own' | 'team'; empty: string }) {
  if (documents.length === 0) return <p className="text-[var(--on-surface-variant)]">{empty}</p>;
  return (
    <ul className="divide-y divide-[var(--outline-variant)]">
      {documents.map((document) => (
        <DocumentRow key={document.id} document={document} scope={scope} />
      ))}
    </ul>
  );
}

/** Tipos de archivo admitidos, también las fotos HEIC del iPhone. */
export const DOCUMENT_ACCEPT = 'application/pdf,image/jpeg,image/png,image/heic,image/heif,.pdf,.jpg,.jpeg,.png,.heic,.heif';
