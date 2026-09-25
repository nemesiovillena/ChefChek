'use client';

import { useState } from 'react';
import { ArrowLeft, FileText, Loader2, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useNotification } from '@/components/notification-system';
import { openSictedAttachment, useSictedMaintenanceRecords } from '@/hooks/use-sicted-maintenance';
import type { ChecklistMaintenancePlan } from '@/lib/sicted-maintenance-types';
import { SictedMaintenanceRecordForm } from './sicted-maintenance-record-form';

const MANAGE_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN'];

const fmtDate = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric' }).format(
        new Date(iso),
      )
    : '—';

interface SictedMaintenancePlanDetailProps {
  plan: ChecklistMaintenancePlan;
  onBack: () => void;
}

/** Ficha de un plan: equipo, próxima/última revisión, histórico con adjuntos, registrar nueva revisión. */
export function SictedMaintenancePlanDetail({ plan, onBack }: SictedMaintenancePlanDetailProps) {
  const { user } = useAuth();
  const notify = useNotification();
  const { data: records, isLoading } = useSictedMaintenanceRecords(plan.id);
  const [showForm, setShowForm] = useState(false);
  const canManage = MANAGE_ROLES.includes(user?.role ?? '');

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-4 flex min-h-[40px] items-center gap-2 text-[var(--on-surface-variant)]">
        <ArrowLeft className="h-4 w-4" />
        Volver al calendario
      </button>

      <div className="mb-4 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
        <h3 className="font-semibold">{plan.title}</h3>
        <p className="text-sm text-[var(--on-surface-variant)]">
          {plan.asset.name} · cada {plan.periodicityMonths} mes(es)
        </p>
        <p className="mt-2 text-sm">
          Última: {fmtDate(plan.lastDoneAt)} · Próxima: <strong>{fmtDate(plan.nextDueAt)}</strong>
        </p>
        {plan.responsible && <p className="text-sm text-[var(--on-surface-variant)]">Responsable: {plan.responsible}</p>}
      </div>

      {showForm ? (
        <SictedMaintenanceRecordForm
          planId={plan.id}
          onSaved={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mb-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 font-medium text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          Registrar revisión
        </button>
      )}

      <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--on-surface-variant)]">Histórico</h4>
      {isLoading ? (
        <div className="flex h-24 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
        </div>
      ) : !records || records.length === 0 ? (
        <p className="text-sm text-[var(--on-surface-variant)]">Sin revisiones registradas todavía.</p>
      ) : (
        <div className="space-y-2">
          {records.map((r) => (
            <div key={r.id} className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{fmtDate(r.performedAt)}</p>
                <p className="text-sm text-[var(--on-surface-variant)]">
                  {r.performedByName}
                  {r.providerName && ` · ${r.providerName}`}
                  {r.cost != null && ` · ${r.cost}€`}
                </p>
              </div>
              {r.notes && <p className="mt-1 text-sm text-[var(--on-surface-variant)]">{r.notes}</p>}
              {r.attachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {r.attachments.map((att, idx) => (
                    <button
                      key={att.storageKey}
                      type="button"
                      onClick={() =>
                        openSictedAttachment(r.id, idx, att, () =>
                          notify({ type: 'error', title: 'Ventana bloqueada', message: 'Permite popups para este sitio.' }),
                        )
                      }
                      className="flex min-h-[36px] items-center gap-1 rounded-lg bg-[var(--surface-container)] px-2 text-xs text-[var(--primary)]"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {att.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {!canManage && <p className="mt-4 text-xs text-[var(--on-surface-variant)]">Solo ADMIN/OWNER editan equipos y planes.</p>}
    </div>
  );
}
