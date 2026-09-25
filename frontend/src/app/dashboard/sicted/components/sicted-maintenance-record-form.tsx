'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, Paperclip, Save } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useCreateSictedMaintenanceRecord } from '@/hooks/use-sicted-maintenance';

const inputCls =
  'min-h-[48px] w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-base';

interface SictedMaintenanceRecordFormProps {
  planId: string;
  onSaved: () => void;
  onCancel: () => void;
}

/** Registrar una revisión hecha: quién, empresa externa, coste, notas, adjuntos (PDF/foto del certificado). */
export function SictedMaintenanceRecordForm({ planId, onSaved, onCancel }: SictedMaintenanceRecordFormProps) {
  const notify = useNotification();
  const create = useCreateSictedMaintenanceRecord();
  const [performedByName, setPerformedByName] = useState('');
  const [providerName, setProviderName] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!performedByName.trim()) {
      notify({ type: 'error', title: 'Falta el "quién"', message: 'Quién hizo la revisión es obligatorio.' });
      return;
    }
    try {
      await create.mutateAsync({
        planId,
        performedByName: performedByName.trim(),
        providerName: providerName.trim() || undefined,
        cost: cost ? Number(cost) : undefined,
        notes: notes.trim() || undefined,
        files,
      });
      notify({ type: 'success', title: 'Revisión registrada', message: 'La próxima fecha se ha recalculado.' });
      onSaved();
    } catch (err) {
      notify({ type: 'error', title: 'Error al guardar', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
      <input
        value={performedByName}
        onChange={(e) => setPerformedByName(e.target.value)}
        placeholder="Quién hizo la revisión"
        className={inputCls}
      />
      <input
        value={providerName}
        onChange={(e) => setProviderName(e.target.value)}
        placeholder="Empresa externa (si aplica)"
        className={inputCls}
      />
      <input
        type="number"
        inputMode="decimal"
        value={cost}
        onChange={(e) => setCost(e.target.value)}
        placeholder="Coste (€, opcional)"
        className={inputCls}
      />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notas…"
        className={`${inputCls} min-h-[64px] py-2`}
      />
      <label className="flex min-h-[48px] cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[var(--outline-variant)] px-3 text-sm text-[var(--on-surface-variant)]">
        <Paperclip className="h-4 w-4 shrink-0" />
        {files.length > 0 ? `${files.length} adjunto(s) elegido(s)` : 'Adjuntar certificado (PDF, foto)…'}
        <input
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/png,image/heic,image/heif"
          capture="environment"
          className="hidden"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
      </label>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={create.isPending}
          className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 font-medium text-primary-foreground disabled:opacity-40"
        >
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Registrar revisión
        </button>
        <button type="button" onClick={onCancel} className="min-h-[48px] rounded-xl border border-[var(--outline-variant)] px-4 font-medium">
          Cancelar
        </button>
      </div>
    </form>
  );
}
