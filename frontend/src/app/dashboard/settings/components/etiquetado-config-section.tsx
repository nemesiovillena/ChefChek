'use client';

import { useState } from 'react';
import { Tag, Plus, Trash2 } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useModules } from '@/features/modules/hooks/use-modules';
import {
  useEtiquetadoConfig,
  useUpdateEtiquetadoConfig,
  type ThermalProfile,
} from '@/hooks/use-food-labels';

interface DraftProfile {
  id: string;
  name: string;
  widthMm: string;
  heightMm: string;
}

const toDraft = (p: ThermalProfile): DraftProfile => ({
  id: p.id,
  name: p.name,
  widthMm: String(p.widthMm),
  heightMm: String(p.heightMm),
});

/**
 * Configuración de perfiles de etiquetadora térmica por tenant (Ajustes →
 * Etiquetas). Las medidas dependen de la impresora del usuario. Las hojas A4
 * son formatos estándar built-in y no se configuran aquí.
 */
export function EtiquetadoConfigSection() {
  const { isEnabled } = useModules();
  const addNotification = useNotification();
  const { data: config } = useEtiquetadoConfig();
  const updateConfig = useUpdateEtiquetadoConfig();

  const [drafts, setDrafts] = useState<DraftProfile[] | null>(null);
  const rows = drafts ?? (config?.thermalProfiles ?? []).map(toDraft);

  if (!isEnabled('etiquetado')) return null;

  const patch = (i: number, field: keyof DraftProfile, value: string) => {
    setDrafts(
      rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)),
    );
  };

  const add = () =>
    setDrafts([
      ...rows,
      { id: `rollo-${Date.now()}`, name: '', widthMm: '57', heightMm: '40' },
    ]);

  const remove = (i: number) => setDrafts(rows.filter((_, idx) => idx !== i));

  const save = async () => {
    const parsed = rows.map((r) => ({
      id: r.id,
      name: r.name.trim() || `Etiqueta ${r.widthMm}×${r.heightMm}`,
      widthMm: parseFloat(r.widthMm.replace(',', '.')),
      heightMm: parseFloat(r.heightMm.replace(',', '.')),
    }));
    if (parsed.some((p) => !Number.isFinite(p.widthMm) || !Number.isFinite(p.heightMm))) {
      addNotification({ type: 'error', title: 'Medidas no válidas', message: 'Revisa el ancho y alto en mm.' });
      return;
    }
    try {
      await updateConfig.mutateAsync(parsed);
      setDrafts(null);
      addNotification({ type: 'success', title: 'Guardado', message: 'Perfiles de etiqueta actualizados.' });
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
        Medidas de tu etiquetadora térmica (rollo). Se usan al imprimir etiquetas
        de cocina. Las hojas A4 son formatos estándar y no necesitan
        configuración.
      </p>

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
          disabled={updateConfig.isPending || drafts === null}
          className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {updateConfig.isPending ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}
