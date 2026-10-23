'use client';

import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useJustifyAbsence } from '@/hooks/use-turnos';
import type { Absence, AbsenceType } from '@/lib/turnos-types';
import { errorMessage, inputCls, labelCls, primaryBtnCls, secondaryBtnCls } from '../../check-in/components/check-in-form-styles';

interface Props {
  absence: Absence;
  types: AbsenceType[];
  onDone: (justified: Absence | null) => void;
}

/**
 * Justificar una ausencia: elegir el tipo correcto cuando ya se conoce el
 * motivo (p. ej. «Ausencia no justificada» → «Baja médica»). Mismas fechas.
 */
export function AbsenceJustifyForm({ absence, types, onDone }: Props) {
  const notify = useNotification();
  const justify = useJustifyAbsence();
  const options = types.filter((t) => t.isActive && t.id !== absence.type.id);
  const [typeId, setTypeId] = useState(options[0]?.id ?? '');
  const [note, setNote] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!typeId) return;
    try {
      const justified = await justify.mutateAsync({ id: absence.id, absenceTypeId: typeId, note: note.trim() || undefined });
      notify({ type: 'success', title: 'Ausencia justificada', message: justified.type.name });
      onDone(justified);
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }

  if (options.length === 0) {
    return <p className="text-sm text-[var(--on-surface-variant)]">No hay otro tipo de ausencia activo al que pasarla.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border-t border-[var(--outline-variant)] pt-3">
      <label className="block">
        <span className={labelCls}>Nuevo tipo</span>
        <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className={inputCls}>
          {options.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={labelCls}>Nota (opcional)</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
        <span className="mt-1 block text-sm text-[var(--on-surface-variant)]">
          Mismas fechas. La anterior queda en el historial como cancelada. No anotes diagnósticos ni datos de salud.
        </span>
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={justify.isPending} className={`${primaryBtnCls} flex-1`}>
          {justify.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Justificar
        </button>
        <button type="button" onClick={() => onDone(null)} className={secondaryBtnCls}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
