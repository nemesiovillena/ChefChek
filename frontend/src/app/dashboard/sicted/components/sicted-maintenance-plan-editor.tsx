'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, Save } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useCreateSictedMaintenancePlan, useSictedAssets } from '@/hooks/use-sicted-maintenance';

const inputCls =
  'min-h-[48px] w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-base';

interface SictedMaintenancePlanEditorProps {
  onSaved: () => void;
  onCancel: () => void;
}

/** Nuevo plan de revisión: elegir equipo, título, periodicidad. */
export function SictedMaintenancePlanEditor({ onSaved, onCancel }: SictedMaintenancePlanEditorProps) {
  const notify = useNotification();
  const { data: assets } = useSictedAssets();
  const create = useCreateSictedMaintenancePlan();
  const [assetId, setAssetId] = useState('');
  const [title, setTitle] = useState('');
  const [periodicityMonths, setPeriodicityMonths] = useState('12');
  const [externalProvider, setExternalProvider] = useState(false);
  const [responsible, setResponsible] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!assetId || !title.trim()) {
      notify({ type: 'error', title: 'Faltan datos', message: 'Equipo y título son obligatorios.' });
      return;
    }
    try {
      await create.mutateAsync({
        assetId,
        title: title.trim(),
        periodicityMonths: Number(periodicityMonths),
        externalProvider,
        responsible: responsible.trim() || undefined,
      });
      notify({ type: 'success', title: 'Plan creado', message: title });
      onSaved();
    } catch (err) {
      notify({ type: 'error', title: 'Error al guardar', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
      <select value={assetId} onChange={(e) => setAssetId(e.target.value)} className={inputCls} style={{ colorScheme: 'light dark' }}>
        <option value="">Elige un equipo…</option>
        {(assets ?? []).map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título del plan (ej. Revisión anual)" className={inputCls} />
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          max={60}
          value={periodicityMonths}
          onChange={(e) => setPeriodicityMonths(e.target.value)}
          className={`${inputCls} w-24`}
        />
        <span className="text-sm text-[var(--on-surface-variant)]">meses de periodicidad</span>
      </div>
      <input
        value={responsible}
        onChange={(e) => setResponsible(e.target.value)}
        placeholder="Responsable (opcional)"
        className={inputCls}
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={externalProvider} onChange={(e) => setExternalProvider(e.target.checked)} />
        La revisión la hace una empresa externa
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={create.isPending}
          className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 font-medium text-primary-foreground disabled:opacity-40"
        >
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Crear plan
        </button>
        <button type="button" onClick={onCancel} className="min-h-[48px] rounded-xl border border-[var(--outline-variant)] px-4 font-medium">
          Cancelar
        </button>
      </div>
    </form>
  );
}
