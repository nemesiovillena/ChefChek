'use client';

import { useState } from 'react';
import { Snowflake } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useAuth } from '@/contexts/auth.context';
import {
  useConservationDefaults,
  useUpdateConservationDefaults,
} from '@/hooks/use-conservation-defaults';

const inputClass =
  'mt-1 w-24 rounded-md border border-gray-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-800';
const labelClass = 'text-sm';
const hintClass = 'block text-gray-600 dark:text-gray-400';

/**
 * Valores por defecto de conservación/vida útil (Ajustes → Conservación).
 * Alimentan el autorrelleno del ConservationFieldset al elegir Refrigerado o
 * Congelado en los modales de Receta y Artículo — un único juego de valores
 * compartido por ambos módulos.
 */
export function ConservationDefaultsSection() {
  const { user } = useAuth();
  const addNotification = useNotification();
  const { data: defaults } = useConservationDefaults();
  const updateDefaults = useUpdateConservationDefaults();
  const isAdmin = ['ADMIN', 'OWNER', 'SUPERADMIN'].includes(user?.role ?? '');

  const [draft, setDraft] = useState<Record<string, string> | null>(null);

  const values = draft ?? {
    refrigeratedTempMin: String(defaults?.refrigerated.tempMin ?? ''),
    refrigeratedTempMax: String(defaults?.refrigerated.tempMax ?? ''),
    refrigeratedShelfLifeDays: String(defaults?.refrigerated.shelfLifeDays ?? ''),
    frozenTempMin: String(defaults?.frozen.tempMin ?? ''),
    frozenTempMax: String(defaults?.frozen.tempMax ?? ''),
    frozenShelfLifeDays: String(defaults?.frozen.shelfLifeDays ?? ''),
  };

  const patch = (field: string, v: string) => setDraft({ ...values, [field]: v });

  const save = async () => {
    const parsed = Object.fromEntries(
      Object.entries(values).map(([k, v]) => [k, parseFloat(v.replace(',', '.'))]),
    );
    if (Object.values(parsed).some((n) => !Number.isFinite(n))) {
      addNotification({ type: 'error', title: 'Valores no válidos', message: 'Revisa las temperaturas y los días.' });
      return;
    }
    try {
      await updateDefaults.mutateAsync(parsed);
      setDraft(null);
      addNotification({ type: 'success', title: 'Guardado', message: 'Valores de conservación actualizados.' });
    } catch (e: unknown) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: e instanceof Error ? e.message : 'No se pudo guardar.',
      });
    }
  };

  return (
    <div className="bg-white shadow rounded-lg mb-6 p-6 dark:bg-zinc-900">
      <div className="flex items-center gap-2 mb-4">
        <Snowflake className="h-5 w-5 text-indigo-600" />
        <h2 className="text-xl font-semibold">Conservación</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Al elegir Refrigerado o Congelado en Recetas o Artículos, la
        temperatura y la vida útil se rellenan solas con estos valores; se
        pueden editar en cada receta/artículo sin tocar esto.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <fieldset className="rounded-lg border border-gray-200 p-3 dark:border-zinc-700">
          <legend className="px-1 text-sm font-medium text-gray-700 dark:text-gray-300">Refrigerado</legend>
          <div className="flex flex-wrap items-end gap-3">
            <label className={labelClass}>
              <span className={hintClass}>Temp. mín. (°C)</span>
              <input
                inputMode="decimal"
                disabled={!isAdmin}
                value={values.refrigeratedTempMin}
                onChange={(e) => patch('refrigeratedTempMin', e.target.value)}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              <span className={hintClass}>Temp. máx. (°C)</span>
              <input
                inputMode="decimal"
                disabled={!isAdmin}
                value={values.refrigeratedTempMax}
                onChange={(e) => patch('refrigeratedTempMax', e.target.value)}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              <span className={hintClass}>Vida útil (días)</span>
              <input
                inputMode="numeric"
                disabled={!isAdmin}
                value={values.refrigeratedShelfLifeDays}
                onChange={(e) => patch('refrigeratedShelfLifeDays', e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="rounded-lg border border-gray-200 p-3 dark:border-zinc-700">
          <legend className="px-1 text-sm font-medium text-gray-700 dark:text-gray-300">Congelado</legend>
          <div className="flex flex-wrap items-end gap-3">
            <label className={labelClass}>
              <span className={hintClass}>Temp. mín. (°C)</span>
              <input
                inputMode="decimal"
                disabled={!isAdmin}
                value={values.frozenTempMin}
                onChange={(e) => patch('frozenTempMin', e.target.value)}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              <span className={hintClass}>Temp. máx. (°C)</span>
              <input
                inputMode="decimal"
                disabled={!isAdmin}
                value={values.frozenTempMax}
                onChange={(e) => patch('frozenTempMax', e.target.value)}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              <span className={hintClass}>Vida útil congelado (días)</span>
              <input
                inputMode="numeric"
                disabled={!isAdmin}
                value={values.frozenShelfLifeDays}
                onChange={(e) => patch('frozenShelfLifeDays', e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
        </fieldset>
      </div>

      {isAdmin && (
        <div className="mt-4">
          <button
            type="button"
            onClick={save}
            disabled={updateDefaults.isPending || draft === null}
            className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {updateDefaults.isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      )}
    </div>
  );
}
