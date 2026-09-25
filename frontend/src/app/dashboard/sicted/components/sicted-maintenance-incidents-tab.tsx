'use client';

import { useState } from 'react';
import { AlertTriangle, ClipboardList, Loader2, Plus } from 'lucide-react';
import { useSictedIncidents } from '@/hooks/use-sicted-maintenance';
import {
  CHECKLIST_INCIDENT_KIND_LABELS,
  CHECKLIST_INCIDENT_STATUS_LABELS,
  type ChecklistIncidentKind,
} from '@/lib/sicted-maintenance-types';
import { SictedIncidentForm } from './sicted-incident-form';
import { SictedIncidentDetail } from './sicted-incident-detail';

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(iso),
  );

/** Partes de avería (Ins-Bas.16) y acciones correctivas (PAC) — dos formularios reales distintos. */
export function SictedMaintenanceIncidentsTab() {
  const { data: incidents, isLoading } = useSictedIncidents();
  const [creatingKind, setCreatingKind] = useState<ChecklistIncidentKind | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (selectedId) {
    return <SictedIncidentDetail incidentId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => setCreatingKind('BREAKDOWN')}
          className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--outline-variant)] px-4 text-sm font-medium"
        >
          <AlertTriangle className="h-4 w-4" />
          Nueva avería
        </button>
        <button
          type="button"
          onClick={() => setCreatingKind('CORRECTIVE_ACTION')}
          className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-medium text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          Nueva PAC
        </button>
      </div>

      {creatingKind && (
        <SictedIncidentForm kind={creatingKind} onSaved={() => setCreatingKind(null)} onCancel={() => setCreatingKind(null)} />
      )}

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
        </div>
      ) : !incidents || incidents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--outline-variant)] p-10 text-center text-[var(--on-surface-variant)]">
          <ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-50" />
          Sin incidencias registradas.
        </div>
      ) : (
        <div className="space-y-2">
          {incidents.map((inc) => (
            <button
              key={inc.id}
              type="button"
              onClick={() => setSelectedId(inc.id)}
              className="flex w-full items-center justify-between rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-3 text-left hover:bg-[var(--surface-container)]"
            >
              <div>
                <p className="font-medium">
                  {inc.kind === 'CORRECTIVE_ACTION' && inc.partNumber ? `Parte Nº ${inc.partNumber} · ` : ''}
                  {inc.asset?.name ?? CHECKLIST_INCIDENT_KIND_LABELS[inc.kind]}
                </p>
                <p className="text-sm text-[var(--on-surface-variant)]">
                  {CHECKLIST_INCIDENT_KIND_LABELS[inc.kind]} · {fmtDate(inc.detectedAt)}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-xs font-semibold ${
                  inc.status === 'RESOLVED'
                    ? 'bg-[var(--surface-container-high)] text-[var(--on-surface)]'
                    : 'bg-[var(--error-container)] text-[var(--on-error-container)]'
                }`}
              >
                {CHECKLIST_INCIDENT_STATUS_LABELS[inc.status]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
