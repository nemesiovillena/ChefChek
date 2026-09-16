'use client';

import { useResponsibleOptions } from '@/hooks/use-food-labels';

export interface ResponsibleValue {
  responsibleUserId?: string;
  responsibleName?: string;
}

/** Valor del <select> cuando no hay usuario elegido y toca escribir el nombre a mano. */
const OTHER_VALUE = '__otro__';

const fieldClass =
  'mt-1 block w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-base text-[var(--on-surface)]';
const labelClass = 'block text-sm font-medium text-[var(--on-surface)]';

/**
 * Quién ha realizado la elaboración/manipulación: puede no coincidir con la
 * sesión abierta (dispositivo compartido en cocina). Prioriza elegir de la
 * lista de Usuarios del tenant; si no está en la lista, "Otro" permite
 * escribir el nombre a mano.
 */
export default function ResponsibleField({
  value,
  onChange,
  label = 'Responsable',
}: {
  value: ResponsibleValue;
  onChange: (next: ResponsibleValue) => void;
  label?: string;
}) {
  const options = useResponsibleOptions();
  const isOther = !value.responsibleUserId && value.responsibleName !== undefined;
  const selectValue = value.responsibleUserId ?? (isOther ? OTHER_VALUE : '');

  return (
    <div>
      <label className="block">
        <span className={labelClass}>{label}</span>
        <select
          className={fieldClass}
          style={{ colorScheme: 'light dark' }}
          value={selectValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v === OTHER_VALUE) {
              onChange({ responsibleName: '' });
            } else if (v === '') {
              onChange({});
            } else {
              onChange({ responsibleUserId: v });
            }
          }}
        >
          <option value="">Elige quién lo prepara…</option>
          {(options.data ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
          <option value={OTHER_VALUE}>Otro (escribir nombre)…</option>
        </select>
      </label>
      {isOther && (
        <input
          className={`${fieldClass} mt-2`}
          placeholder="Nombre y apellido"
          value={value.responsibleName ?? ''}
          onChange={(e) => onChange({ responsibleName: e.target.value })}
          autoFocus
        />
      )}
    </div>
  );
}
