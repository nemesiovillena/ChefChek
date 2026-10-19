'use client';

import { useState } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotification } from '@/components/notification-system';
import { useConfirm } from '@/contexts/confirm.context';
import { useCreateServingMeasure, useDeleteServingMeasure, useServingMeasures, useUpdateServingMeasure } from '@/hooks/use-cuiner';
import type { ServingMeasure, ServingMeasureInput } from '@/lib/cuiner-types';
import { formatMeasure } from '@/lib/cuiner-serving-measure-suggestion';
import { inputCls } from './cuiner-link-cell';

const UNITS = ['cl', 'ml', 'l', 'g', 'kg', 'ud'];

interface Draft {
  name: string;
  quantity: string;
  unit: string;
  keywords: string;
}

const toDraft = (m?: ServingMeasure): Draft => ({
  name: m?.name ?? '',
  quantity: m ? String(m.quantity).replace('.', ',') : '',
  unit: m?.unit ?? 'cl',
  keywords: m?.keywords.join(', ') ?? '',
});

function parseDraft(draft: Draft): ServingMeasureInput | string {
  const name = draft.name.trim();
  const quantity = Number(draft.quantity.replace(',', '.'));
  if (!name) return 'Pon un nombre a la medida';
  if (!(quantity > 0)) return 'La cantidad tiene que ser mayor que 0';
  const keywords = draft.keywords
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  return { name, quantity, unit: draft.unit, keywords };
}

function MeasureForm({
  initial,
  saving,
  onSave,
  onCancel,
}: {
  initial: Draft;
  saving: boolean;
  onSave: (input: ServingMeasureInput) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState('');
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <form
      className="grid gap-2 rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-900 dark:bg-indigo-950/30 md:grid-cols-[1.2fr_0.6fr_0.6fr_2fr_auto] md:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = parseDraft(draft);
        if (typeof parsed === 'string') {
          setError(parsed);
          return;
        }
        setError('');
        onSave(parsed);
      }}
    >
      <label className="text-sm">
        Nombre
        <input className={inputCls} value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Chupito" autoFocus />
      </label>
      <label className="text-sm">
        Cantidad
        <input
          className={inputCls}
          inputMode="decimal"
          value={draft.quantity}
          onChange={(e) => set({ quantity: e.target.value })}
          placeholder="4"
        />
      </label>
      <label className="text-sm">
        Unidad
        <select className={inputCls} value={draft.unit} onChange={(e) => set({ unit: e.target.value })}>
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Palabras en el TPV (separadas por comas)
        <input
          className={inputCls}
          value={draft.keywords}
          onChange={(e) => set({ keywords: e.target.value })}
          placeholder="CHUPITO, CHUP"
        />
      </label>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
      {error && <p className="text-sm text-red-600 md:col-span-5">{error}</p>}
    </form>
  );
}

/**
 * Medidas con las que se sirven los artículos de venta directa (chupito,
 * copa, caña…). Al enlazar un plato con un artículo se elige una, y cada
 * venta descuenta esa cantidad en vez del artículo entero.
 */
export function CuinerServingMeasuresTab() {
  const notify = useNotification();
  const confirm = useConfirm();
  const { data, isLoading, error } = useServingMeasures();
  const create = useCreateServingMeasure();
  const update = useUpdateServingMeasure();
  const remove = useDeleteServingMeasure();
  const [editing, setEditing] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>, title: string) {
    try {
      await action();
      setEditing(null);
    } catch (err) {
      notify({
        type: 'error',
        title,
        message: err instanceof Error ? err.message : '',
      });
    }
  }

  async function askDelete(measure: ServingMeasure) {
    const ok = await confirm({
      title: 'Eliminar medida',
      description: `¿Eliminar «${measure.name}» (${formatMeasure(measure)})?`,
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (ok) await run(() => remove.mutateAsync(measure.id), 'No se pudo eliminar la medida');
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-gray-600 dark:text-zinc-400">
          Cuánto sale de un artículo en cada venta. Al enlazar un plato con un artículo eliges la medida, y la app la propone según las
          palabras del nombre del plato en el TPV. Si cambias una cantidad, cuenta para las ventas que se apliquen a partir de ahora.
        </p>
        {editing !== 'new' && (
          <Button type="button" size="sm" onClick={() => setEditing('new')}>
            <Plus className="mr-1 h-4 w-4" /> Nueva medida
          </Button>
        )}
      </div>

      {editing === 'new' && (
        <MeasureForm
          initial={toDraft()}
          saving={create.isPending}
          onCancel={() => setEditing(null)}
          onSave={(input) => run(() => create.mutateAsync(input), 'No se pudo crear la medida')}
        />
      )}

      {isLoading && <Loader2 className="mx-auto my-8 h-6 w-6 animate-spin text-gray-400" />}
      {error && <p className="text-sm text-red-600">{error.message}</p>}

      {data && (
        <ul className="divide-y divide-gray-200 dark:divide-zinc-800">
          {data.map((m) =>
            editing === m.id ? (
              <li key={m.id} className="py-3">
                <MeasureForm
                  initial={toDraft(m)}
                  saving={update.isPending}
                  onCancel={() => setEditing(null)}
                  onSave={(input) => run(() => update.mutateAsync({ id: m.id, ...input }), 'No se pudo guardar la medida')}
                />
              </li>
            ) : (
              <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                <p className="min-w-[9rem] font-medium">{m.name}</p>
                <p className="min-w-[4rem] font-mono text-sm">{formatMeasure(m)}</p>
                <p className="flex flex-1 flex-wrap gap-1">
                  {m.keywords.map((k) => (
                    <span key={k} className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                      {k}
                    </span>
                  ))}
                </p>
                <p className="text-xs text-muted-foreground">{m.linkedDishes === 1 ? '1 plato' : `${m.linkedDishes} platos`}</p>
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant="ghost" aria-label={`Editar ${m.name}`} onClick={() => setEditing(m.id)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`Eliminar ${m.name}`}
                    disabled={m.linkedDishes > 0}
                    title={m.linkedDishes > 0 ? 'La usan platos enlazados: cámbiales la medida antes' : undefined}
                    onClick={() => askDelete(m)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
