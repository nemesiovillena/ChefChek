'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, Save } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useCreateSictedIncident, useSictedAssets } from '@/hooks/use-sicted-maintenance';
import type { ChecklistIncidentKind, CreateChecklistIncidentInput } from '@/lib/sicted-maintenance-types';

const inputCls =
  'min-h-[48px] w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-base';
const textareaCls = `${inputCls} min-h-[80px] py-2`;

interface SictedIncidentFormProps {
  kind: ChecklistIncidentKind;
  onSaved: () => void;
  onCancel: () => void;
}

/** Los dos formularios reales (Ins-Bas.16 / PAC) — campos distintos según `kind`. */
export function SictedIncidentForm({ kind, onSaved, onCancel }: SictedIncidentFormProps) {
  const notify = useNotification();
  const { data: assets } = useSictedAssets();
  const create = useCreateSictedIncident();
  const [form, setForm] = useState<CreateChecklistIncidentInput>({ kind, detectedByName: '' });

  const set = <K extends keyof CreateChecklistIncidentInput>(key: K, value: CreateChecklistIncidentInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.detectedByName.trim()) {
      notify({ type: 'error', title: 'Falta quién lo detectó', message: 'Ese campo es obligatorio.' });
      return;
    }
    if (kind === 'CORRECTIVE_ACTION' && !form.deviationDescription?.trim()) {
      notify({ type: 'error', title: 'Falta la desviación', message: 'Describe la desviación observada.' });
      return;
    }
    try {
      await create.mutateAsync(form);
      notify({ type: 'success', title: kind === 'BREAKDOWN' ? 'Avería registrada' : 'PAC registrada', message: '' });
      onSaved();
    } catch (err) {
      notify({ type: 'error', title: 'Error al guardar', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
      <select
        value={form.assetId ?? ''}
        onChange={(e) => set('assetId', e.target.value || undefined)}
        className={inputCls}
        style={{ colorScheme: 'light dark' }}
      >
        <option value="">Equipo (opcional)…</option>
        {(assets ?? []).map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <input
        value={form.detectedByName}
        onChange={(e) => set('detectedByName', e.target.value)}
        placeholder="Quién lo detectó"
        className={inputCls}
      />

      {kind === 'BREAKDOWN' ? (
        <>
          <input
            value={form.faultType ?? ''}
            onChange={(e) => set('faultType', e.target.value)}
            placeholder="Clase de avería (ej. No calienta)"
            className={inputCls}
          />
          <input
            value={form.reportedTo ?? ''}
            onChange={(e) => set('reportedTo', e.target.value)}
            placeholder="A quién se avisa (servicio técnico)"
            className={inputCls}
          />
        </>
      ) : (
        <>
          <input
            value={form.processOrEquipment ?? ''}
            onChange={(e) => set('processOrEquipment', e.target.value)}
            placeholder="Proceso / instalación / equipo / producto"
            className={inputCls}
          />
          <textarea
            value={form.deviationDescription ?? ''}
            onChange={(e) => set('deviationDescription', e.target.value)}
            placeholder="Descripción de la desviación (obligatorio)"
            className={textareaCls}
          />
          <textarea
            value={form.deviationCause ?? ''}
            onChange={(e) => set('deviationCause', e.target.value)}
            placeholder="Causa (si se conoce)…"
            className={textareaCls}
          />
          <input
            value={form.responsibleName ?? ''}
            onChange={(e) => set('responsibleName', e.target.value)}
            placeholder="Responsable de la acción correctiva"
            className={inputCls}
          />
          <p className="text-xs text-[var(--on-surface-variant)]">Solo cuando sean alimentos:</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={form.affectedLot ?? ''}
              onChange={(e) => set('affectedLot', e.target.value)}
              placeholder="Lote afectado"
              className={inputCls}
            />
            <input
              value={form.affectedProductName ?? ''}
              onChange={(e) => set('affectedProductName', e.target.value)}
              placeholder="Producto afectado"
              className={inputCls}
            />
          </div>
        </>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={create.isPending}
          className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 font-medium text-primary-foreground disabled:opacity-40"
        >
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar
        </button>
        <button type="button" onClick={onCancel} className="min-h-[48px] rounded-xl border border-[var(--outline-variant)] px-4 font-medium">
          Cancelar
        </button>
      </div>
    </form>
  );
}
