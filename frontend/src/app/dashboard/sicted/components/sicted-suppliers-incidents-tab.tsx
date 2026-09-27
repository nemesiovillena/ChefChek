'use client';

import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ClipboardList, Loader2, Plus } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useSuppliers } from '@/hooks/use-suppliers';
import { listAlbaranes } from '@/lib/api-albaran';
import {
  useCreateSictedSupplierIncident,
  useResolveSictedSupplierIncident,
  useSictedSupplierIncidents,
} from '@/hooks/use-sicted-suppliers';
import type { CreateSupplierIncidentInput } from '@/lib/sicted-supplier-types';

const inputCls =
  'min-h-[48px] w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-base';
const textareaCls = `${inputCls} min-h-[80px] py-2`;

const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

/** Alta de incidencia — formulario real PROV.3: fecha, proveedor, nº de albarán, ¿transporte correcto?, temperatura, causa de rechazo, firma. */
function SictedSupplierIncidentForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const notify = useNotification();
  const { data: suppliers } = useSuppliers({ isActive: true });
  const create = useCreateSictedSupplierIncident();
  const [form, setForm] = useState<CreateSupplierIncidentInput>({
    supplierId: '',
    description: '',
    reportedByName: '',
  });
  // `useAlbaranes` guarda su filtro en un `useState` que solo lee el
  // argumento en el montaje — no reacciona a que `form.supplierId` cambie en
  // renders posteriores (el desplegable se quedaba siempre vacío tras elegir
  // proveedor). `useQuery` directo sí es reactivo al `queryKey`.
  const { data: recentAlbaranesPage } = useQuery({
    queryKey: ['albaranes', 'sicted-incident-picker', form.supplierId],
    queryFn: () => listAlbaranes({ supplierId: form.supplierId, limit: 10 }),
    enabled: !!form.supplierId,
  });
  const recentAlbaranes = recentAlbaranesPage?.data ?? [];

  const set = <K extends keyof CreateSupplierIncidentInput>(key: K, value: CreateSupplierIncidentInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.supplierId) {
      notify({ type: 'error', title: 'Falta el proveedor', message: 'Selecciona el proveedor de la recepción.' });
      return;
    }
    if (!form.description.trim() || !form.reportedByName.trim()) {
      notify({ type: 'error', title: 'Faltan campos', message: 'Descripción y quién lo notifica son obligatorios.' });
      return;
    }
    try {
      await create.mutateAsync(form);
      notify({ type: 'success', title: 'Incidencia registrada', message: '' });
      onSaved();
    } catch (err) {
      notify({ type: 'error', title: 'Error al guardar', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 space-y-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4"
    >
      <select
        value={form.supplierId}
        onChange={(e) => set('supplierId', e.target.value)}
        className={inputCls}
        style={{ colorScheme: 'light dark' }}
      >
        <option value="">Proveedor…</option>
        {(suppliers ?? []).map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      <select
        value={form.albaranId ?? ''}
        onChange={(e) => set('albaranId', e.target.value || undefined)}
        disabled={!form.supplierId}
        className={inputCls}
        style={{ colorScheme: 'light dark' }}
      >
        <option value="">Albarán (opcional)…</option>
        {recentAlbaranes.map((a) => (
          <option key={a.id} value={a.id}>
            {a.albaranNumber || a.internalNumber} — {new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid' }).format(new Date(a.date))}
          </option>
        ))}
      </select>

      <div className="grid grid-cols-2 gap-2">
        <select
          value={form.transportOk === undefined ? '' : String(form.transportOk)}
          onChange={(e) => set('transportOk', e.target.value === '' ? undefined : e.target.value === 'true')}
          className={inputCls}
          style={{ colorScheme: 'light dark' }}
        >
          <option value="">¿Transporte correcto?</option>
          <option value="true">Sí</option>
          <option value="false">No</option>
        </select>
        <input
          type="number"
          step="0.1"
          value={form.productTemperature ?? ''}
          onChange={(e) => set('productTemperature', e.target.value === '' ? undefined : Number(e.target.value))}
          placeholder="Temperatura del producto (°C)"
          className={inputCls}
        />
      </div>

      <input
        value={form.rejectionCause ?? ''}
        onChange={(e) => set('rejectionCause', e.target.value)}
        placeholder="Causa de rechazo (si aplica)"
        className={inputCls}
      />
      <textarea
        value={form.description}
        onChange={(e) => set('description', e.target.value)}
        placeholder="Descripción de la incidencia (obligatorio)"
        className={textareaCls}
      />
      <input
        value={form.reportedByName}
        onChange={(e) => set('reportedByName', e.target.value)}
        placeholder="Quién lo notifica (firma)"
        className={inputCls}
      />

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={create.isPending}
          className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 font-medium text-primary-foreground disabled:opacity-40"
        >
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Registrar incidencia
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[48px] rounded-xl border border-[var(--outline-variant)] px-4 font-medium"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function SictedSupplierIncidentDetail({
  incidentId,
  supplierName,
  onBack,
}: {
  incidentId: string;
  supplierName: string;
  onBack: () => void;
}) {
  const notify = useNotification();
  const { data: incidents } = useSictedSupplierIncidents();
  const resolve = useResolveSictedSupplierIncident();
  const [resolution, setResolution] = useState('');
  const incident = incidents?.find((i) => i.id === incidentId);

  if (!incident) return null;

  async function handleResolve() {
    if (!resolution.trim()) {
      notify({ type: 'error', title: 'Falta la resolución', message: 'Describe cómo se resolvió.' });
      return;
    }
    try {
      await resolve.mutateAsync({ id: incidentId, resolution: resolution.trim() });
      notify({ type: 'success', title: 'Incidencia resuelta', message: '' });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-4 flex min-h-[40px] items-center gap-2 text-[var(--on-surface-variant)]">
        ← Volver
      </button>
      <div className="mb-4 space-y-1 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
        <h3 className="font-semibold">{supplierName}</h3>
        <p className="text-sm text-[var(--on-surface-variant)]">{fmtDateTime(incident.occurredAt)}</p>
        <p className="mt-2 text-sm">{incident.description}</p>
        {incident.transportOk !== null && (
          <p className="text-sm">Transporte correcto: {incident.transportOk ? 'Sí' : 'No'}</p>
        )}
        {incident.productTemperature !== null && <p className="text-sm">Temperatura: {incident.productTemperature} °C</p>}
        {incident.rejectionCause && <p className="text-sm">Causa de rechazo: {incident.rejectionCause}</p>}
        <p className="text-sm text-[var(--on-surface-variant)]">Notificado por {incident.reportedByName}</p>
      </div>

      {incident.resolvedAt ? (
        <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4">
          <p className="flex items-center gap-2 font-medium text-[var(--primary)]">
            <CheckCircle2 className="h-5 w-5" /> Resuelta el {fmtDateTime(incident.resolvedAt)}
          </p>
          <p className="mt-2 text-sm">{incident.resolution}</p>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
          <textarea
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="Cómo se resolvió (obligatorio)"
            className={`${inputCls} min-h-[64px] py-2`}
          />
          <button
            type="button"
            disabled={resolve.isPending}
            onClick={handleResolve}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 font-medium text-primary-foreground disabled:opacity-40"
          >
            {resolve.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Resolver
          </button>
        </div>
      )}
    </div>
  );
}

/** PROV.3 — incidencias de recepción. */
export function SictedSuppliersIncidentsTab() {
  const { data: incidents, isLoading } = useSictedSupplierIncidents();
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (selectedId) {
    const selected = incidents?.find((i) => i.id === selectedId);
    return (
      <SictedSupplierIncidentDetail
        incidentId={selectedId}
        supplierName={selected?.supplierName ?? ''}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-medium text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Nueva incidencia
        </button>
      </div>

      {creating && <SictedSupplierIncidentForm onSaved={() => setCreating(false)} onCancel={() => setCreating(false)} />}

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
        </div>
      ) : !incidents || incidents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--outline-variant)] p-10 text-center text-[var(--on-surface-variant)]">
          <ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-50" />
          Sin incidencias de recepción registradas.
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
                <p className="font-medium">{inc.supplierName}</p>
                <p className="text-sm text-[var(--on-surface-variant)]">{fmtDateTime(inc.occurredAt)}</p>
              </div>
              <span
                className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                  inc.resolvedAt
                    ? 'bg-[var(--surface-container-high)] text-[var(--on-surface)]'
                    : 'bg-[var(--error-container)] text-[var(--on-error-container)]'
                }`}
              >
                {inc.resolvedAt ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                {inc.resolvedAt ? 'Resuelta' : 'Abierta'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
