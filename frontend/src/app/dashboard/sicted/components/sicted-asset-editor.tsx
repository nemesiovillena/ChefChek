'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, Save } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useCreateSictedAsset, useUpdateSictedAsset } from '@/hooks/use-sicted-maintenance';
import {
  CHECKLIST_ASSET_CATEGORIES,
  CHECKLIST_ASSET_CATEGORY_LABELS,
  type ChecklistAsset,
  type ChecklistAssetInput,
} from '@/lib/sicted-maintenance-types';

const inputCls =
  'min-h-[48px] w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-base';

interface SictedAssetEditorProps {
  asset: ChecklistAsset | null;
  onSaved: () => void;
  onCancel: () => void;
}

/** Crear/editar un equipo (el inventario del mantenimiento). */
export function SictedAssetEditor({ asset, onSaved, onCancel }: SictedAssetEditorProps) {
  const notify = useNotification();
  const create = useCreateSictedAsset();
  const update = useUpdateSictedAsset();
  const [form, setForm] = useState<ChecklistAssetInput>(() =>
    asset
      ? {
          name: asset.name,
          externalCode: asset.externalCode ?? undefined,
          category: asset.category,
          location: asset.location ?? undefined,
          provider: asset.provider ?? undefined,
        }
      : { name: '', category: 'OTRO' },
  );

  const set = <K extends keyof ChecklistAssetInput>(key: K, value: ChecklistAssetInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      notify({ type: 'error', title: 'Falta el nombre', message: 'El nombre del equipo es obligatorio.' });
      return;
    }
    try {
      if (asset) {
        await update.mutateAsync({ id: asset.id, data: form });
      } else {
        await create.mutateAsync(form);
      }
      notify({ type: 'success', title: 'Guardado', message: form.name });
      onSaved();
    } catch (err) {
      notify({ type: 'error', title: 'Error al guardar', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  const isPending = create.isPending || update.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Nombre del equipo" className={inputCls} />
      <select
        value={form.category}
        onChange={(e) => set('category', e.target.value as ChecklistAssetInput['category'])}
        className={inputCls}
        style={{ colorScheme: 'light dark' }}
      >
        {CHECKLIST_ASSET_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {CHECKLIST_ASSET_CATEGORY_LABELS[c]}
          </option>
        ))}
      </select>
      <input
        value={form.location ?? ''}
        onChange={(e) => set('location', e.target.value)}
        placeholder="Ubicación (ej. Cocina, Almacén)"
        className={inputCls}
      />
      <input
        value={form.provider ?? ''}
        onChange={(e) => set('provider', e.target.value)}
        placeholder="Empresa proveedora (si aplica)"
        className={inputCls}
      />
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 font-medium text-primary-foreground disabled:opacity-40"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar
        </button>
        <button type="button" onClick={onCancel} className="min-h-[48px] rounded-xl border border-[var(--outline-variant)] px-4 font-medium">
          Cancelar
        </button>
      </div>
    </form>
  );
}
