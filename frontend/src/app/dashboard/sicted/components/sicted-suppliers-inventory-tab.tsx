'use client';

import { useState, type FormEvent } from 'react';
import { AlertTriangle, ArrowLeft, Camera, ClipboardList, Loader2 } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import {
  useGenerateSictedInventorySnapshot,
  useSictedInventorySnapshot,
  useSictedInventorySnapshots,
} from '@/hooks/use-sicted-suppliers';
import type { CreateInventorySnapshotInput } from '@/lib/sicted-supplier-types';

const inputCls =
  'min-h-[48px] w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-base';

const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

function SictedInventorySnapshotForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const notify = useNotification();
  const generate = useGenerateSictedInventorySnapshot();
  const [form, setForm] = useState<CreateInventorySnapshotInput>({ performedByName: '' });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.performedByName.trim()) {
      notify({ type: 'error', title: 'Falta la firma', message: 'Indica quién realiza el inventario.' });
      return;
    }
    try {
      await generate.mutateAsync(form);
      notify({ type: 'success', title: 'Inventario generado', message: 'Queda como evidencia permanente.' });
      onSaved();
    } catch (err) {
      notify({ type: 'error', title: 'Error al generar', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
      <p className="text-sm text-[var(--on-surface-variant)]">
        Genera una foto+firma del stock actual (cantidad, mínimo y máximo de cada artículo). Queda como evidencia permanente, no se puede editar
        ni borrar.
      </p>
      <input
        value={form.performedByName}
        onChange={(e) => setForm((p) => ({ ...p, performedByName: e.target.value }))}
        placeholder="Quién realiza el inventario (firma)"
        className={inputCls}
      />
      <input
        value={form.scope ?? ''}
        onChange={(e) => setForm((p) => ({ ...p, scope: e.target.value }))}
        placeholder="Área/almacén (opcional)"
        className={inputCls}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={generate.isPending}
          className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 font-medium text-primary-foreground disabled:opacity-40"
        >
          {generate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          Generar inventario
        </button>
        <button type="button" onClick={onCancel} className="min-h-[48px] rounded-xl border border-[var(--outline-variant)] px-4 font-medium">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function SictedInventorySnapshotDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { data: snapshot, isLoading } = useSictedInventorySnapshot(id);

  if (isLoading || !snapshot) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  const alerts = snapshot.snapshotData.filter((l) => l.belowMinimum || l.aboveMaximum);

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-4 flex min-h-[40px] items-center gap-2 text-[var(--on-surface-variant)]">
        <ArrowLeft className="h-4 w-4" />
        Volver
      </button>
      <div className="mb-4 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
        <h3 className="font-semibold">{fmtDateTime(snapshot.performedAt)}</h3>
        <p className="text-sm text-[var(--on-surface-variant)]">
          Firmado por {snapshot.performedByName}
          {snapshot.scope ? ` · ${snapshot.scope}` : ''}
        </p>
        <p className="mt-2 text-sm">
          {snapshot.itemCount} artículos · {snapshot.belowMinimumCount} bajo mínimo · {snapshot.aboveMaximumCount} sobre máximo
        </p>
      </div>

      {alerts.length === 0 ? (
        <p className="text-sm text-[var(--on-surface-variant)]">Ningún artículo fuera de rango en este inventario.</p>
      ) : (
        <div className="space-y-1">
          {alerts.map((line) => (
            <div
              key={line.productId}
              className="flex items-center justify-between rounded-lg bg-[var(--error-container)] px-3 py-2 text-sm text-[var(--on-error-container)]"
            >
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5" />
                {line.productName}
              </span>
              <span>
                {line.quantity} ({line.belowMinimum ? `mín. ${line.minimumStock}` : `máx. ${line.maximumStock}`})
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** PROV.7 — inventario semestral: foto+firma de `Stock`, no un formulario de líneas manual. */
export function SictedSuppliersInventoryTab() {
  const { data: snapshots, isLoading } = useSictedInventorySnapshots();
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (selectedId) {
    return <SictedInventorySnapshotDetail id={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-medium text-primary-foreground"
        >
          <Camera className="h-4 w-4" /> Generar inventario
        </button>
      </div>

      {creating && <SictedInventorySnapshotForm onSaved={() => setCreating(false)} onCancel={() => setCreating(false)} />}

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
        </div>
      ) : !snapshots || snapshots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--outline-variant)] p-10 text-center text-[var(--on-surface-variant)]">
          <ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-50" />
          Sin inventarios generados. El manual recomienda uno semestral (no es obligatorio).
        </div>
      ) : (
        <div className="space-y-2">
          {snapshots.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelectedId(s.id)}
              className="flex w-full items-center justify-between rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-3 text-left hover:bg-[var(--surface-container)]"
            >
              <div>
                <p className="font-medium">{fmtDateTime(s.performedAt)}</p>
                <p className="text-sm text-[var(--on-surface-variant)]">
                  {s.performedByName}
                  {s.scope ? ` · ${s.scope}` : ''} · {s.itemCount} artículos
                </p>
              </div>
              {s.belowMinimumCount + s.aboveMaximumCount > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-[var(--error-container)] px-2 py-1 text-xs font-semibold text-[var(--on-error-container)]">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {s.belowMinimumCount + s.aboveMaximumCount}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
