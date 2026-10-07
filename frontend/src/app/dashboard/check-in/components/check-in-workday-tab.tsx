'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, Save } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { Switch } from '@/components/ui/switch';
import { useCheckInSettings, useUpdateCheckInSettings } from '@/hooks/use-check-in';
import type { CheckInSettings } from '@/lib/check-in-types';
import { cardCls, errorMessage, inputCls, labelCls, primaryBtnCls } from './check-in-form-styles';

function WorkdayForm({ settings }: { settings: CheckInSettings }) {
  const notify = useNotification();
  const update = useUpdateCheckInSettings();
  const [breaksCountAsWork, setBreaksCountAsWork] = useState(settings.breaksCountAsWork);
  const [autoCloseAfterHours, setAutoCloseAfterHours] = useState(settings.autoCloseAfterHours);
  const [pinLength, setPinLength] = useState(settings.pinLength);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await update.mutateAsync({ breaksCountAsWork, autoCloseAfterHours, pinLength });
      notify({ type: 'success', title: 'Ajustes guardados', message: '' });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${cardCls} space-y-5`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">Las pausas cortas cuentan como tiempo de trabajo</p>
          <p className="text-sm text-[var(--on-surface-variant)]">
            Afecta a las pausas fichadas dentro de un tramo (descanso, bocadillo). El hueco de un turno partido nunca
            cuenta. El cambio se aplica a los periodos abiertos, no a hojas ya aprobadas.
          </p>
        </div>
        <Switch
          checked={breaksCountAsWork}
          onCheckedChange={setBreaksCountAsWork}
          aria-label="Las pausas cortas cuentan como tiempo de trabajo"
        />
      </div>

      <label className="block">
        <span className={labelCls}>Avisar de jornada sin cerrar pasadas (horas)</span>
        <input
          type="number"
          min={1}
          max={48}
          value={autoCloseAfterHours}
          onChange={(e) => setAutoCloseAfterHours(Number(e.target.value))}
          className={`${inputCls} max-w-[160px]`}
        />
        <span className="mt-1 block text-sm text-[var(--on-surface-variant)]">
          Si alguien olvida fichar la salida, se marca como incidencia; nunca se inventa una hora.
        </span>
      </label>

      <label className="block">
        <span className={labelCls}>Longitud del PIN de kiosco</span>
        <select value={pinLength} onChange={(e) => setPinLength(Number(e.target.value))} className={`${inputCls} max-w-[160px]`}>
          {[4, 5, 6].map((n) => (
            <option key={n} value={n}>
              {n} dígitos
            </option>
          ))}
        </select>
        {pinLength !== settings.pinLength && (
          <span className="mt-1 block text-sm text-[var(--error)]">
            Los PIN ya asignados siguen valiendo; los nuevos tendrán {pinLength} dígitos.
          </span>
        )}
      </label>

      <button type="submit" disabled={update.isPending} className={primaryBtnCls}>
        {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Guardar
      </button>
    </form>
  );
}

/** Jornada y pausas: interruptor de pausas computables, aviso de jornada abierta y PIN. */
export function CheckInWorkdayTab() {
  const { data, isLoading } = useCheckInSettings();
  if (isLoading || !data) return <p className="text-[var(--on-surface-variant)]">Cargando…</p>;
  return <WorkdayForm key={data.settings.updatedAt} settings={data.settings} />;
}
