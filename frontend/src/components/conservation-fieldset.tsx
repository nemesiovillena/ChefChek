'use client';

/**
 * Campos de conservación / vida útil compartidos por el modal de Receta y el de
 * Artículo. Alimentan los valores por defecto de la etiqueta (módulo
 * Etiquetado) y son editables puntualmente al imprimir cada etiqueta.
 *
 * Trabaja con strings (igual que el `formData` de ambos modales); el padre
 * convierte a número al construir el payload.
 */

export const STORAGE_CONDITION_OPTIONS = [
  { value: '', label: 'Sin especificar' },
  { value: 'REFRIGERATED', label: 'Refrigerado' },
  { value: 'FROZEN', label: 'Congelado' },
  { value: 'AMBIENT', label: 'Temperatura ambiente' },
] as const;

export interface ConservationValue {
  /** Días de vida útil: tras elaboración (receta) o tras apertura/manipulación (artículo). */
  shelfLifeDays: string;
  shelfLifeFrozenDays: string;
  storageCondition: string;
  storageTempMin: string;
  storageTempMax: string;
}

export const EMPTY_CONSERVATION: ConservationValue = {
  shelfLifeDays: '',
  shelfLifeFrozenDays: '',
  storageCondition: '',
  storageTempMin: '',
  storageTempMax: '',
};

interface ConservationFieldsetProps {
  value: ConservationValue;
  onChange: (patch: Partial<ConservationValue>) => void;
  /** Texto para el campo de vida útil principal. */
  shelfLifeLabel?: string;
  labelClass?: string;
  fieldClass?: string;
}

export default function ConservationFieldset({
  value,
  onChange,
  shelfLifeLabel = 'Vida útil (días)',
  labelClass = 'block text-sm font-medium text-[var(--on-surface)]',
  fieldClass = 'mt-1 block w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-base text-[var(--on-surface)]',
}: ConservationFieldsetProps) {
  const set = (field: keyof ConservationValue) => (v: string) =>
    onChange({ [field]: v });

  return (
    <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-3">
      <div className="mb-2 text-sm font-semibold text-[var(--on-surface)]">
        Conservación y vida útil
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Condición de conservación</label>
          <select
            value={value.storageCondition}
            onChange={(e) => set('storageCondition')(e.target.value)}
            className={fieldClass}
            style={{ colorScheme: 'light dark' }}
          >
            {STORAGE_CONDITION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>{shelfLifeLabel}</label>
          <input
            type="text"
            inputMode="numeric"
            value={value.shelfLifeDays}
            onChange={(e) => set('shelfLifeDays')(e.target.value)}
            className={fieldClass}
            placeholder="ej. 5"
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>Temp. mín. (°C)</label>
          <input
            type="text"
            inputMode="decimal"
            value={value.storageTempMin}
            onChange={(e) => set('storageTempMin')(e.target.value)}
            className={fieldClass}
            placeholder="0"
          />
        </div>
        <div>
          <label className={labelClass}>Temp. máx. (°C)</label>
          <input
            type="text"
            inputMode="decimal"
            value={value.storageTempMax}
            onChange={(e) => set('storageTempMax')(e.target.value)}
            className={fieldClass}
            placeholder="4"
          />
        </div>
        <div>
          <label className={labelClass}>Vida útil congelado (días)</label>
          <input
            type="text"
            inputMode="numeric"
            value={value.shelfLifeFrozenDays}
            onChange={(e) => set('shelfLifeFrozenDays')(e.target.value)}
            className={fieldClass}
            placeholder="opcional"
          />
        </div>
      </div>

      <p className="mt-2 text-xs text-[var(--on-surface-variant)]">
        Se usan como valores por defecto al generar una etiqueta; puedes
        ajustarlos en cada etiqueta.
      </p>
    </div>
  );
}
