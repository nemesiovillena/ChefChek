'use client';

import { useState } from 'react';
import { ArrowLeft, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useSictedIncident, useUpdateSictedIncident } from '@/hooks/use-sicted-maintenance';
import { CHECKLIST_INCIDENT_STATUS_LABELS } from '@/lib/sicted-maintenance-types';

const inputCls =
  'min-h-[48px] w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-base';

const fmtDateTime = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('es-ES', {
        timeZone: 'Europe/Madrid',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso))
    : null;

interface SictedIncidentDetailProps {
  incidentId: string;
  onBack: () => void;
}

interface Milestone {
  key: 'technicianNotifiedAt' | 'serviceStartedAt' | 'serviceEndedAt' | 'resolvedAt';
  label: string;
}

const BREAKDOWN_MILESTONES: Milestone[] = [
  { key: 'technicianNotifiedAt', label: 'Técnico avisado' },
  { key: 'serviceStartedAt', label: 'Servicio iniciado' },
  { key: 'serviceEndedAt', label: 'Servicio finalizado' },
  { key: 'resolvedAt', label: 'Resuelta' },
];

/** Ficha de una incidencia: datos + línea de tiempo de hitos (una vez puesto, no se puede reescribir). */
export function SictedIncidentDetail({ incidentId, onBack }: SictedIncidentDetailProps) {
  const notify = useNotification();
  const { data: incident, isLoading } = useSictedIncident(incidentId);
  const update = useUpdateSictedIncident();
  const [resolution, setResolution] = useState('');
  const [correctiveMeasure, setCorrectiveMeasure] = useState('');

  if (isLoading || !incident) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  /** El hito también avanza `status` — si no, la insignia se queda en "Abierta" aunque ya esté resuelta. */
  async function markMilestone(key: Milestone['key']) {
    const statusForMilestone: Record<Milestone['key'], 'NOTIFIED' | 'RESOLVED' | undefined> = {
      technicianNotifiedAt: 'NOTIFIED',
      serviceStartedAt: undefined,
      serviceEndedAt: undefined,
      resolvedAt: 'RESOLVED',
    };
    try {
      await update.mutateAsync({
        id: incidentId,
        data: { [key]: new Date().toISOString(), status: statusForMilestone[key] },
      });
      notify({ type: 'success', title: 'Actualizado', message: '' });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  async function resolveCorrectiveAction() {
    if (!correctiveMeasure.trim()) {
      notify({ type: 'error', title: 'Falta la medida correctiva', message: 'Describe qué se hizo.' });
      return;
    }
    try {
      await update.mutateAsync({
        id: incidentId,
        data: {
          correctiveMeasure: correctiveMeasure.trim(),
          resolution: resolution.trim() || undefined,
          resolvedAt: new Date().toISOString(),
          status: 'RESOLVED',
        },
      });
      notify({ type: 'success', title: 'PAC resuelta', message: '' });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-4 flex min-h-[40px] items-center gap-2 text-[var(--on-surface-variant)]">
        <ArrowLeft className="h-4 w-4" />
        Volver
      </button>

      <div className="mb-4 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
        <h3 className="font-semibold">
          {incident.kind === 'CORRECTIVE_ACTION' && incident.partNumber ? `Parte Nº ${incident.partNumber} · ` : ''}
          {incident.asset?.name ?? 'Sin equipo'}
        </h3>
        <p className="text-sm text-[var(--on-surface-variant)]">
          {CHECKLIST_INCIDENT_STATUS_LABELS[incident.status]} · detectado por {incident.detectedByName}
        </p>
        {incident.faultType && <p className="mt-2 text-sm">{incident.faultType}</p>}
        {incident.deviationDescription && <p className="mt-2 text-sm">{incident.deviationDescription}</p>}
      </div>

      {incident.kind === 'BREAKDOWN' ? (
        <div className="space-y-2">
          {BREAKDOWN_MILESTONES.map((m) => {
            const value = incident[m.key] as string | null;
            return (
              <div
                key={m.key}
                className="flex items-center justify-between rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  {value ? (
                    <CheckCircle2 className="h-5 w-5 text-[var(--primary)]" />
                  ) : (
                    <Circle className="h-5 w-5 text-[var(--on-surface-variant)]" />
                  )}
                  <span className={value ? '' : 'text-[var(--on-surface-variant)]'}>{m.label}</span>
                </div>
                {value ? (
                  <span className="text-sm text-[var(--on-surface-variant)]">{fmtDateTime(value)}</span>
                ) : (
                  <button
                    type="button"
                    disabled={update.isPending}
                    onClick={() => markMilestone(m.key)}
                    className="min-h-[40px] rounded-lg bg-[var(--primary)] px-3 text-sm font-medium text-primary-foreground disabled:opacity-40"
                  >
                    Marcar ahora
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : incident.resolvedAt ? (
        <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4">
          <p className="flex items-center gap-2 font-medium text-[var(--primary)]">
            <CheckCircle2 className="h-5 w-5" /> Resuelta el {fmtDateTime(incident.resolvedAt)}
          </p>
          <p className="mt-2 text-sm">{incident.correctiveMeasure}</p>
          {incident.resolution && <p className="mt-1 text-sm text-[var(--on-surface-variant)]">{incident.resolution}</p>}
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
          <textarea
            value={correctiveMeasure}
            onChange={(e) => setCorrectiveMeasure(e.target.value)}
            placeholder="Medida correctiva aplicada (obligatorio para resolver)"
            className={`${inputCls} min-h-[64px] py-2`}
          />
          <textarea
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="Notas de resolución (opcional)…"
            className={`${inputCls} min-h-[64px] py-2`}
          />
          <button
            type="button"
            disabled={update.isPending}
            onClick={resolveCorrectiveAction}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 font-medium text-primary-foreground disabled:opacity-40"
          >
            {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Resolver PAC
          </button>
        </div>
      )}
    </div>
  );
}
