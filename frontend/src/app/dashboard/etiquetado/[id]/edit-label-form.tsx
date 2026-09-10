'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import ConservationFieldset, {
  ConservationValue,
} from '@/components/conservation-fieldset';
import {
  FoodLabel,
  StorageCondition,
  UpdateFoodLabelInput,
} from '@/hooks/use-food-labels';

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO → valor de <input type="datetime-local"> en hora local. */
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** ISO → valor de <input type="date"> en hora local. */
function toDateInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Texto numérico (admite coma) → number | undefined. */
function num(s: string): number | undefined {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

const CONDITION_DEFAULTS: Record<string, Partial<ConservationValue>> = {
  FROZEN: { storageTempMin: '-15', shelfLifeFrozenDays: '90' },
  REFRIGERATED: { storageTempMin: '2', shelfLifeDays: '5' },
};

const fieldClass =
  'mt-1 block w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-base text-[var(--on-surface)]';
const labelClass = 'block text-sm font-medium text-[var(--on-surface)]';

interface Props {
  label: FoodLabel;
  saving: boolean;
  onCancel: () => void;
  onSave: (input: UpdateFoodLabelInput) => void;
}

export default function EditLabelForm({
  label,
  saving,
  onCancel,
  onSave,
}: Props) {
  const initial = useMemo(
    () => ({
      preparedAt: toDatetimeLocal(label.preparedAt),
      freeze: label.frozenAt !== null,
      frozenAt: toDatetimeLocal(label.frozenAt ?? new Date().toISOString()),
      cons: {
        shelfLifeDays: label.shelfLifeDaysApplied?.toString() ?? '',
        shelfLifeFrozenDays: '',
        storageCondition: label.storageCondition,
        storageTempMin: label.storageTempMin?.toString() ?? '',
        storageTempMax: label.storageTempMax?.toString() ?? '',
      } as ConservationValue,
      useByDate: toDateInput(label.useByDate),
      manufacturerExpiry: toDateInput(label.manufacturerExpiryDate),
      quantity: label.quantity?.toString() ?? '',
      quantityUnit: label.quantityUnit ?? '',
      portions: label.portions?.toString() ?? '',
      notes: label.notes ?? '',
    }),
    [label],
  );

  const [preparedAt, setPreparedAt] = useState(initial.preparedAt);
  const [freeze, setFreeze] = useState(initial.freeze);
  const [frozenAt, setFrozenAt] = useState(initial.frozenAt);
  const [cons, setCons] = useState<ConservationValue>(initial.cons);
  const [pinUseBy, setPinUseBy] = useState(false);
  const [useByDate, setUseByDate] = useState(initial.useByDate);
  const [manufacturerExpiry, setManufacturerExpiry] = useState(
    initial.manufacturerExpiry,
  );
  const [quantity, setQuantity] = useState(initial.quantity);
  const [quantityUnit, setQuantityUnit] = useState(initial.quantityUnit);
  const [portions, setPortions] = useState(initial.portions);
  const [notes, setNotes] = useState(initial.notes);

  const prepWord =
    label.labelType === 'ELABORATED' ? 'elaboración' : 'manipulación';

  const submit = () => {
    const input: UpdateFoodLabelInput = {};

    if (preparedAt && preparedAt !== initial.preparedAt) {
      input.preparedAt = new Date(preparedAt).toISOString();
    }
    if (freeze !== initial.freeze) {
      input.freeze = freeze;
    }
    if (freeze && frozenAt && frozenAt !== initial.frozenAt) {
      input.frozenAt = new Date(frozenAt).toISOString();
    }
    if (cons.storageCondition !== initial.cons.storageCondition) {
      input.storageCondition = cons.storageCondition as StorageCondition;
    }
    if (cons.storageTempMin !== initial.cons.storageTempMin) {
      input.storageTempMin = num(cons.storageTempMin);
    }
    if (cons.storageTempMax !== initial.cons.storageTempMax) {
      input.storageTempMax = num(cons.storageTempMax);
    }
    if (cons.shelfLifeDays !== initial.cons.shelfLifeDays) {
      input.shelfLifeDays = num(cons.shelfLifeDays);
    }
    if (cons.shelfLifeFrozenDays) {
      input.shelfLifeFrozenDays = num(cons.shelfLifeFrozenDays);
    }
    if (pinUseBy && useByDate) {
      input.useByDate = new Date(`${useByDate}T12:00:00`).toISOString();
    }
    if (manufacturerExpiry !== initial.manufacturerExpiry) {
      input.manufacturerExpiryDate = manufacturerExpiry
        ? new Date(`${manufacturerExpiry}T12:00:00`).toISOString()
        : null;
    }
    if (quantity !== initial.quantity) {
      input.quantity = num(quantity);
    }
    if (quantityUnit.trim() !== initial.quantityUnit.trim()) {
      input.quantityUnit = quantityUnit.trim();
    }
    if (portions !== initial.portions) {
      input.portions = num(portions);
    }
    if (notes.trim() !== initial.notes.trim()) {
      input.notes = notes.trim();
    }

    onSave(input);
  };

  return (
    <div className="space-y-4 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
      <div className="text-sm font-semibold">Corregir etiqueta</div>
      <p className="text-xs text-[var(--on-surface-variant)]">
        Solo antes de reimprimir y el mismo día. Al guardar se recalcula el
        consumo preferente salvo que lo fijes a mano.
      </p>

      <label className="block">
        <span className={labelClass}>Fecha y hora de {prepWord}</span>
        <input
          type="datetime-local"
          className={fieldClass}
          style={{ colorScheme: 'light dark' }}
          value={preparedAt}
          onChange={(e) => {
            setPreparedAt(e.target.value);
            if (
              window.matchMedia('(hover: hover) and (pointer: fine)').matches
            ) {
              e.target.blur();
            }
          }}
        />
      </label>

      <ConservationFieldset
        value={cons}
        onChange={(patch) => {
          const next = { ...cons, ...patch };
          if (
            patch.storageCondition !== undefined &&
            patch.storageCondition !== cons.storageCondition
          ) {
            Object.assign(
              next,
              CONDITION_DEFAULTS[patch.storageCondition] ?? {},
            );
            setFreeze(patch.storageCondition === 'FROZEN');
          }
          setCons(next);
        }}
        shelfLifeLabel={
          label.labelType === 'ELABORATED'
            ? 'Vida útil tras elaboración (días)'
            : 'Vida útil tras manipulación (días)'
        }
      />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={freeze}
          onChange={(e) => {
            setFreeze(e.target.checked);
            if (e.target.checked) {
              setCons({
                ...cons,
                storageCondition: 'FROZEN',
                ...CONDITION_DEFAULTS.FROZEN,
              });
            }
          }}
        />
        Se congela
      </label>

      {freeze && (
        <label className="block">
          <span className={labelClass}>Fecha y hora de congelación</span>
          <input
            type="datetime-local"
            className={fieldClass}
            style={{ colorScheme: 'light dark' }}
            value={frozenAt}
            onChange={(e) => setFrozenAt(e.target.value)}
          />
        </label>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={pinUseBy}
          onChange={(e) => setPinUseBy(e.target.checked)}
        />
        Fijar el consumo preferente a mano
      </label>
      {pinUseBy && (
        <label className="block">
          <span className={labelClass}>Consumo preferente</span>
          <input
            type="date"
            className={fieldClass}
            style={{ colorScheme: 'light dark' }}
            value={useByDate}
            onChange={(e) => setUseByDate(e.target.value)}
          />
        </label>
      )}

      {label.labelType === 'HANDLED' && (
        <label className="block">
          <span className={labelClass}>Caducidad del fabricante</span>
          <input
            type="date"
            className={fieldClass}
            style={{ colorScheme: 'light dark' }}
            value={manufacturerExpiry}
            onChange={(e) => setManufacturerExpiry(e.target.value)}
          />
        </label>
      )}

      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className={labelClass}>Cantidad</span>
          <input
            type="text"
            inputMode="decimal"
            className={fieldClass}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Unidad</span>
          <input
            type="text"
            className={fieldClass}
            value={quantityUnit}
            onChange={(e) => setQuantityUnit(e.target.value)}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Raciones</span>
          <input
            type="text"
            inputMode="decimal"
            className={fieldClass}
            value={portions}
            onChange={(e) => setPortions(e.target.value)}
          />
        </label>
      </div>

      <label className="block">
        <span className={labelClass}>Notas</span>
        <textarea
          className={fieldClass}
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>

      <div className="flex gap-3">
        <Button onClick={submit} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar y reimprimir
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
