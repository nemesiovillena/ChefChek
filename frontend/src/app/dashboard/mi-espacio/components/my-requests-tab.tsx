'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, Plus, Send } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useCancelOwnRequest, useCreateOwnRequest, useOwnRequests } from '@/hooks/use-rrhh';
import { REQUEST_STATUS_LABELS, type EmployeeRequestStatus, type OwnRequestItem } from '@/lib/rrhh-types';
import {
  cardCls,
  errorMessage,
  inputCls,
  primaryBtnCls,
  secondaryBtnCls,
} from '../../check-in/components/check-in-form-styles';

const STATUS_CLS: Record<EmployeeRequestStatus, string> = {
  PENDING: 'bg-amber-500 text-black',
  APPROVED: 'bg-emerald-600 text-white',
  REJECTED: 'bg-[var(--error)] text-[var(--on-error)]',
  CANCELLED: 'bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]',
};

function RequestRow({ item }: { item: OwnRequestItem }) {
  const notify = useNotification();
  const cancel = useCancelOwnRequest();
  async function handleCancel() {
    try {
      await cancel.mutateAsync(item.id);
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }
  return (
    <li className="space-y-1 py-3">
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{item.title}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[item.status]}`}>
          {REQUEST_STATUS_LABELS[item.status]}
        </span>
      </p>
      {item.detail && <p className="text-sm text-[var(--on-surface-variant)]">{item.detail}</p>}
      {item.decisionNote && <p className="text-sm">Respuesta: {item.decisionNote}</p>}
      <p className="flex flex-wrap items-center gap-3 text-xs text-[var(--on-surface-variant)]">
        Enviada el {new Date(item.createdAt).toLocaleDateString('es-ES')}
        {/* Las ausencias y las correcciones se retiran desde su propia pantalla. */}
        {item.source === 'REQUEST' && item.status === 'PENDING' && (
          <button type="button" onClick={handleCancel} disabled={cancel.isPending} className="min-h-[32px] text-sm underline">
            Retirar
          </button>
        )}
      </p>
    </li>
  );
}

/** Petición libre a gerencia ("necesito un certificado de empresa"). */
function OtherRequestForm({ onDone }: { onDone: () => void }) {
  const notify = useNotification();
  const create = useCreateOwnRequest();
  const [message, setMessage] = useState('');
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (message.trim().length < 3) {
      notify({ type: 'error', title: 'Escribe tu solicitud', message: '' });
      return;
    }
    try {
      await create.mutateAsync({ kind: 'OTHER', message: message.trim() });
      notify({ type: 'success', title: 'Solicitud enviada', message: '' });
      onDone();
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }
  return (
    <form onSubmit={handleSubmit} className={`${cardCls} space-y-3`}>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="¿Qué necesitas?"
        aria-label="Tu solicitud"
        className={`${inputCls} min-h-[96px] py-2`}
      />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={create.isPending} className={primaryBtnCls}>
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar
        </button>
        <button type="button" onClick={onDone} className={secondaryBtnCls}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

/** Todo lo que he pedido, en una lista: cambios de datos, correcciones de fichaje y ausencias. */
export function MyRequestsTab() {
  const { data: requests, isLoading } = useOwnRequests();
  const [adding, setAdding] = useState(false);
  if (isLoading || !requests) return <p className="text-[var(--on-surface-variant)]">Cargando…</p>;
  return (
    <div className="space-y-4">
      {adding ? (
        <OtherRequestForm onDone={() => setAdding(false)} />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={primaryBtnCls}>
          <Plus className="h-4 w-4" /> Nueva solicitud
        </button>
      )}
      <div className={cardCls}>
        {requests.length > 0 ? (
          <ul className="divide-y divide-[var(--outline-variant)]">
            {requests.map((item) => (
              <RequestRow key={`${item.source}-${item.id}`} item={item} />
            ))}
          </ul>
        ) : (
          <p className="text-[var(--on-surface-variant)]">Aún no has enviado ninguna solicitud.</p>
        )}
      </div>
    </div>
  );
}
