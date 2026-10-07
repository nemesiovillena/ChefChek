'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Snowflake } from 'lucide-react';
import type { FreezeFoodLabelInput } from '@/hooks/use-food-labels';

const pad = (n: number) => String(n).padStart(2, '0');

/** Date → valor de <input type="datetime-local"> en hora local. */
const toDatetimeLocal = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;

const fieldClass =
  'mt-1 block w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-base text-[var(--on-surface)]';
const labelClass = 'block text-sm font-medium text-[var(--on-surface)]';

interface Props {
  saving: boolean;
  onCancel: () => void;
  onSave: (input: FreezeFoodLabelInput) => void;
}

/**
 * Congelar una etiqueta ya emitida (cualquier día). La fecha admite el pasado
 * porque a menudo se registra después de haber metido el producto al
 * congelador; el backend rechaza si ese día ya había caducado.
 */
export default function FreezeLabelForm({ saving, onCancel, onSave }: Props) {
  const [now] = useState(() => toDatetimeLocal(new Date()));
  const [frozenAt, setFrozenAt] = useState(now);
  const [days, setDays] = useState('');

  const submit = () => {
    const input: FreezeFoodLabelInput = {};
    if (frozenAt) input.frozenAt = new Date(frozenAt).toISOString();
    const n = parseInt(days, 10);
    if (Number.isFinite(n) && n > 0) input.shelfLifeFrozenDays = n;
    onSave(input);
  };

  return (
    <div className="space-y-4 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
      <div className="text-sm font-semibold">Congelar</div>
      <label className="block">
        <span className={labelClass}>Fecha y hora de congelación</span>
        <input
          type="datetime-local"
          className={fieldClass}
          style={{ colorScheme: 'light dark' }}
          max={now}
          value={frozenAt}
          onChange={(e) => setFrozenAt(e.target.value)}
        />
      </label>
      <label className="block">
        <span className={labelClass}>Días de vida útil en congelado</span>
        <input
          type="text"
          inputMode="numeric"
          className={fieldClass}
          placeholder="Los de la receta o artículo"
          value={days}
          onChange={(e) => setDays(e.target.value)}
        />
      </label>
      <p className="text-xs text-[var(--on-surface-variant)]">
        Se mantiene el lote y se recalcula el consumo preferente desde la
        congelación. Si ese día ya había caducado, no se puede congelar.
      </p>
      <div className="flex gap-3">
        <Button onClick={submit} disabled={saving || !frozenAt}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Snowflake className="mr-2 h-4 w-4" />
          )}
          Congelar y reimprimir
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
