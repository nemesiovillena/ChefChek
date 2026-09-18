'use client';

import { useState } from 'react';
import { Tag, Plus, Trash2 } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useAuth } from '@/contexts/auth.context';
import { useModules } from '@/features/modules/hooks/use-modules';
import {
  labelFormatOptions,
  useEtiquetadoConfig,
  useUpdateEtiquetadoConfig,
  type ThermalProfile,
} from '@/hooks/use-food-labels';
import { ZebraPrinterStatus } from './zebra-printer-status';

interface DraftProfile {
  id: string;
  name: string;
  widthMm: string;
  heightMm: string;
  dpi: string;
}

const toDraft = (p: ThermalProfile): DraftProfile => ({
  id: p.id,
  name: p.name,
  widthMm: String(p.widthMm),
  heightMm: String(p.heightMm),
  dpi: String(p.dpi ?? 203),
});

/**
 * Configuración de perfiles de etiquetadora térmica por tenant (Ajustes →
 * Etiquetas). Las medidas dependen de la impresora del usuario. Las hojas A4
 * son formatos estándar built-in y no se configuran aquí.
 */
export function EtiquetadoConfigSection() {
  const { user } = useAuth();
  const { isEnabled } = useModules();
  const addNotification = useNotification();
  const { data: config } = useEtiquetadoConfig();
  const updateConfig = useUpdateEtiquetadoConfig();

  const [drafts, setDrafts] = useState<DraftProfile[] | null>(null);
  const [defaultFormatDraft, setDefaultFormatDraft] = useState<string | null>(null);
  const [expiryWarningDaysDraft, setExpiryWarningDaysDraft] = useState<string | null>(null);
  const rows = drafts ?? (config?.thermalProfiles ?? []).map(toDraft);

  const formatOptions = labelFormatOptions(config);
  const defaultFormat =
    defaultFormatDraft ?? config?.defaultFormat ?? formatOptions[0]?.value ?? '';
  const expiryWarningDays =
    expiryWarningDaysDraft ?? String(config?.expiryWarningDays ?? '');
  // Backend: PUT /etiquetado/config exige @Roles("ADMIN") en todo el
  // endpoint (también thermalProfiles/defaultFormat, ya así antes de este
  // cambio) — este flag solo oculta el input nuevo en el cliente; no
  // introduce ni corrige el gate del resto de la sección.
  const isAdmin = user?.role === 'ADMIN';

  if (!isEnabled('etiquetado')) return null;

  const patch = (i: number, field: keyof DraftProfile, value: string) => {
    setDrafts(
      rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)),
    );
  };

  const add = () =>
    setDrafts([
      ...rows,
      { id: `rollo-${Date.now()}`, name: '', widthMm: '60', heightMm: '40', dpi: '203' },
    ]);

  const remove = (i: number) => setDrafts(rows.filter((_, idx) => idx !== i));

  const save = async () => {
    const parsed = rows.map((r) => ({
      id: r.id,
      name: r.name.trim() || `Etiqueta ${r.widthMm}×${r.heightMm}`,
      widthMm: parseFloat(r.widthMm.replace(',', '.')),
      heightMm: parseFloat(r.heightMm.replace(',', '.')),
      dpi: parseInt(r.dpi, 10) || 203,
    }));
    if (parsed.some((p) => !Number.isFinite(p.widthMm) || !Number.isFinite(p.heightMm))) {
      addNotification({ type: 'error', title: 'Medidas no válidas', message: 'Revisa el ancho y alto en mm.' });
      return;
    }
    const parsedWarningDays = isAdmin && expiryWarningDaysDraft !== null
      ? parseInt(expiryWarningDaysDraft, 10)
      : undefined;
    if (
      parsedWarningDays !== undefined
      && (!Number.isInteger(parsedWarningDays) || parsedWarningDays < 1 || parsedWarningDays > 30)
    ) {
      addNotification({ type: 'error', title: 'Umbral no válido', message: 'El umbral debe ser un número entero entre 1 y 30 días.' });
      return;
    }
    try {
      await updateConfig.mutateAsync({
        thermalProfiles: parsed,
        defaultFormat,
        ...(parsedWarningDays !== undefined ? { expiryWarningDays: parsedWarningDays } : {}),
      });
      setDrafts(null);
      setDefaultFormatDraft(null);
      setExpiryWarningDaysDraft(null);
      addNotification({ type: 'success', title: 'Guardado', message: 'Configuración de etiquetas actualizada.' });
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
        <Tag className="h-5 w-5 text-indigo-600" />
        <h2 className="text-xl font-semibold">Etiquetas</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Medidas y DPI de tu etiquetadora térmica Zebra (rollo). Se generan como
        ZPL y se envían directas a la impresora. Las hojas A4 son formatos
        estándar y no necesitan configuración.
      </p>

      <label className="block text-sm mb-4">
        <span className="block text-gray-600 dark:text-gray-400">
          Formato de impresión por defecto
        </span>
        <select
          className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-800"
          style={{ colorScheme: 'light dark' }}
          value={defaultFormat}
          onChange={(e) => setDefaultFormatDraft(e.target.value)}
        >
          {formatOptions.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-gray-500">
          Al crear o reimprimir una etiqueta se usa este formato; ahí solo
          eliges el número de copias.
        </span>
      </label>

      {isAdmin && (
        <label className="block text-sm mb-4">
          <span className="block text-gray-600 dark:text-gray-400">
            Aviso de caducidad (días de antelación)
          </span>
          <input
            type="number"
            min={1}
            max={30}
            inputMode="numeric"
            value={expiryWarningDays}
            onChange={(e) => setExpiryWarningDaysDraft(e.target.value)}
            className="mt-1 w-24 rounded-md border border-gray-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-800"
          />
          <span className="mt-1 block text-xs text-gray-500">
            Panel de Caducidades (APPCC) y la card del dashboard marcan una
            etiqueta como &quot;próxima a caducar&quot; cuando falten menos de
            estos días. Entre 1 y 30.
          </span>
        </label>
      )}

      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={r.id} className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="block text-gray-600 dark:text-gray-400">Nombre</span>
              <input
                value={r.name}
                onChange={(e) => patch(i, 'name', e.target.value)}
                placeholder="Ej. Rollo cocina"
                className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-800"
              />
            </label>
            <label className="text-sm">
              <span className="block text-gray-600 dark:text-gray-400">Ancho (mm)</span>
              <input
                inputMode="decimal"
                value={r.widthMm}
                onChange={(e) => patch(i, 'widthMm', e.target.value)}
                className="mt-1 w-24 rounded-md border border-gray-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-800"
              />
            </label>
            <label className="text-sm">
              <span className="block text-gray-600 dark:text-gray-400">Alto (mm)</span>
              <input
                inputMode="decimal"
                value={r.heightMm}
                onChange={(e) => patch(i, 'heightMm', e.target.value)}
                className="mt-1 w-24 rounded-md border border-gray-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-800"
              />
            </label>
            <label className="text-sm">
              <span className="block text-gray-600 dark:text-gray-400">DPI</span>
              <input
                inputMode="numeric"
                value={r.dpi}
                onChange={(e) => patch(i, 'dpi', e.target.value)}
                placeholder="203"
                className="mt-1 w-20 rounded-md border border-gray-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-800"
              />
            </label>
            <button
              type="button"
              onClick={() => remove(i)}
              disabled={rows.length <= 1}
              className="mb-1 rounded-md border border-red-200 bg-red-50 p-2 text-red-600 hover:bg-red-100 disabled:opacity-40 dark:border-red-900/40 dark:bg-red-950/30"
              aria-label="Eliminar perfil"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/40 dark:bg-indigo-950/30 dark:text-indigo-300"
        >
          <Plus className="h-4 w-4" />
          Añadir perfil
        </button>
        <button
          type="button"
          onClick={save}
          disabled={
            updateConfig.isPending ||
            (drafts === null && defaultFormatDraft === null && expiryWarningDaysDraft === null)
          }
          className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {updateConfig.isPending ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      <ZebraPrinterStatus />
    </div>
  );
}
