'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useAuth } from '@/contexts/auth.context';
import { useModules } from '@/features/modules/hooks/use-modules';
import { useDecideEmployeeRequest, usePendingEmployeeRequests } from '@/hooks/use-rrhh';
import { PERSONAL_DATA_LABELS, type EmployeeRequest, type PersonalDataField } from '@/lib/rrhh-types';
import {
  canManageCheckIn,
  cardCls,
  errorMessage,
  inputCls,
  primaryBtnCls,
  secondaryBtnCls,
} from '../../check-in/components/check-in-form-styles';
import { CheckInRequestsTab } from '../../check-in/components/check-in-requests-tab';
import { AbsenceRequestsTab } from '../../turnos/components/absence-requests-tab';

export const dynamic = 'force-dynamic';

function RequestCard({ request }: { request: EmployeeRequest }) {
  const notify = useNotification();
  const decide = useDecideEmployeeRequest();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const isDataChange = request.kind === 'DATA_CHANGE';

  async function handle(approve: boolean) {
    if (!approve && !note.trim()) {
      notify({ type: 'error', title: 'Falta la explicación', message: 'Indica por qué se rechaza.' });
      return;
    }
    try {
      await decide.mutateAsync({ id: request.id, approve, note: note.trim() || undefined });
      notify({
        type: 'success',
        title: approve ? (isDataChange ? 'Datos actualizados' : 'Solicitud atendida') : 'Solicitud rechazada',
        message: '',
      });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }

  return (
    <div className={`${cardCls} space-y-2`}>
      <p className="font-medium">
        {request.employeeName} · {isDataChange ? 'Cambio de datos personales' : 'Solicitud'}
      </p>
      {request.changes && (
        <ul className="text-sm">
          {(Object.keys(request.changes) as PersonalDataField[]).map((field) => (
            <li key={field}>
              <span className="text-[var(--on-surface-variant)]">{PERSONAL_DATA_LABELS[field]}:</span> {request.changes?.[field]}
            </li>
          ))}
        </ul>
      )}
      {request.message && <p className="text-sm">{request.message}</p>}
      <p className="text-xs text-[var(--on-surface-variant)]">
        Enviada el {new Date(request.createdAt).toLocaleDateString('es-ES')}
        {isDataChange && ' · Al aprobar, los datos se cambian en su cuenta de Equipo y en su ficha.'}
      </p>
      {rejecting && (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Por qué se rechaza (lo verá la persona)"
          className={`${inputCls} min-h-[72px] py-2`}
        />
      )}
      <div className="flex flex-wrap gap-2">
        {!rejecting && (
          <button type="button" onClick={() => handle(true)} disabled={decide.isPending} className={primaryBtnCls}>
            <Check className="h-4 w-4" /> {isDataChange ? 'Aprobar y aplicar' : 'Marcar como atendida'}
          </button>
        )}
        <button
          type="button"
          onClick={() => (rejecting ? handle(false) : setRejecting(true))}
          disabled={decide.isPending}
          className={secondaryBtnCls}
        >
          <X className="h-4 w-4" /> {rejecting ? 'Confirmar rechazo' : 'Rechazar'}
        </button>
        {rejecting && (
          <button type="button" onClick={() => setRejecting(false)} className="min-h-[48px] px-2 text-sm underline">
            Volver
          </button>
        )}
      </div>
    </div>
  );
}

function EmployeeRequests() {
  const { data: requests, isLoading } = usePendingEmployeeRequests();
  if (isLoading || !requests) return <p className="text-[var(--on-surface-variant)]">Cargando…</p>;
  if (requests.length === 0) return <p className="text-[var(--on-surface-variant)]">No hay solicitudes pendientes.</p>;
  return (
    <div className="space-y-3">
      {requests.map((request) => (
        <RequestCard key={request.id} request={request} />
      ))}
    </div>
  );
}

/** Bandeja única de gerencia: todo lo que el equipo ha pedido y espera respuesta. */
export default function TeamRequestsPage() {
  const { user, isLoading } = useAuth();
  const { isEnabled } = useModules();
  if (isLoading) return null;
  return (
    <div className="px-margin-mobile md:px-margin-desktop mx-auto max-w-container-max-width space-y-8 pb-28 pt-8">
      <h2 className="font-headline-lg text-headline-lg text-primary">Solicitudes del equipo</h2>
      {!canManageCheckIn(user) ? (
        <p className="text-[var(--on-surface-variant)]">Solo gerencia, desde su cuenta personal, responde las solicitudes.</p>
      ) : (
        <>
          <section>
            <h3 className="mb-3 text-lg font-semibold">Datos personales y otras peticiones</h3>
            <EmployeeRequests />
          </section>
          <section>
            <h3 className="mb-3 text-lg font-semibold">Correcciones de fichaje</h3>
            <CheckInRequestsTab />
          </section>
          {isEnabled('turnos') && (
            <section>
              <h3 className="mb-3 text-lg font-semibold">Ausencias y vacaciones</h3>
              <AbsenceRequestsTab />
            </section>
          )}
        </>
      )}
    </div>
  );
}
