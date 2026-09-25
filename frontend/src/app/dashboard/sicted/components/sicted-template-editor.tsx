'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, Plus, Save } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useCreateSictedTemplate, useUpdateSictedTemplate } from '@/hooks/use-sicted';
import {
  CHECKLIST_FREQUENCIES,
  CHECKLIST_FREQUENCY_LABELS,
  CHECKLIST_KIND_LABELS,
  CHECKLIST_KINDS,
  CHECKLIST_MODES,
  CHECKLIST_MODE_LABELS,
  type ChecklistTemplate,
  type ChecklistTemplateInput,
  type ChecklistTemplateItemInput,
} from '@/lib/sicted-types';
import { SictedTemplateItemEditor } from './sicted-template-item-editor';

const inputCls =
  'min-h-[48px] w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-base';

interface SictedTemplateEditorProps {
  template: ChecklistTemplate | null;
  onSaved: () => void;
  onCancel: () => void;
}

function toInput(template: ChecklistTemplate | null): ChecklistTemplateInput {
  if (!template) {
    return { name: '', kind: 'CLEANING', mode: 'EXECUTION', area: '', frequency: 'DAILY', items: [] };
  }
  return {
    name: template.name,
    externalCode: template.externalCode ?? undefined,
    kind: template.kind,
    mode: template.mode,
    area: template.area,
    frequency: template.frequency,
    weekday: template.weekday ?? undefined,
    dayOfMonth: template.dayOfMonth ?? undefined,
    responsiblePosition: template.responsiblePosition ?? undefined,
    requiresSupervisor: template.requiresSupervisor,
    practiceRef: template.practiceRef ?? undefined,
    items: template.items.map((i) => ({
      label: i.label,
      itemFrequency: i.itemFrequency ?? undefined,
      procedure: i.procedure ?? undefined,
      products: i.products,
      dosage: i.dosage ?? undefined,
      epi: i.epi ?? undefined,
      isRequired: i.isRequired,
      expectedRangeMin: i.expectedRangeMin ?? undefined,
      expectedRangeMax: i.expectedRangeMax ?? undefined,
    })),
  };
}

/** Crear/editar una plantilla (el Plan): campos + lista de ítems. PUT sube `version` automáticamente en el backend. */
export function SictedTemplateEditor({ template, onSaved, onCancel }: SictedTemplateEditorProps) {
  const notify = useNotification();
  const create = useCreateSictedTemplate();
  const update = useUpdateSictedTemplate();
  const [form, setForm] = useState<ChecklistTemplateInput>(() => toInput(template));

  const set = <K extends keyof ChecklistTemplateInput>(key: K, value: ChecklistTemplateInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  function addItem() {
    const item: ChecklistTemplateItemInput = { label: '', isRequired: true };
    setForm((prev) => ({ ...prev, items: [...prev.items, item] }));
  }

  function updateItem(index: number, item: ChecklistTemplateItemInput) {
    setForm((prev) => ({ ...prev, items: prev.items.map((i, idx) => (idx === index ? item : i)) }));
  }

  function removeItem(index: number) {
    setForm((prev) => ({ ...prev, items: prev.items.filter((_, idx) => idx !== index) }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.area.trim() || form.items.length === 0) {
      notify({ type: 'error', title: 'Faltan datos', message: 'Nombre, área y al menos un ítem son obligatorios.' });
      return;
    }
    try {
      if (template) {
        await update.mutateAsync({ id: template.id, data: form });
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Nombre de la plantilla" className={inputCls} />
        <input value={form.area} onChange={(e) => set('area', e.target.value)} placeholder="Área (ej. Cocina)" className={inputCls} />
        <select value={form.kind} onChange={(e) => set('kind', e.target.value as ChecklistTemplateInput['kind'])} className={inputCls} style={{ colorScheme: 'light dark' }}>
          {CHECKLIST_KINDS.map((k) => (
            <option key={k} value={k}>
              {CHECKLIST_KIND_LABELS[k]}
            </option>
          ))}
        </select>
        <select value={form.mode} onChange={(e) => set('mode', e.target.value as ChecklistTemplateInput['mode'])} className={inputCls} style={{ colorScheme: 'light dark' }}>
          {CHECKLIST_MODES.map((m) => (
            <option key={m} value={m}>
              {CHECKLIST_MODE_LABELS[m]}
            </option>
          ))}
        </select>
        <select value={form.frequency} onChange={(e) => set('frequency', e.target.value as ChecklistTemplateInput['frequency'])} className={inputCls} style={{ colorScheme: 'light dark' }}>
          {CHECKLIST_FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              {CHECKLIST_FREQUENCY_LABELS[f]}
            </option>
          ))}
        </select>
        <input
          value={form.responsiblePosition ?? ''}
          onChange={(e) => set('responsiblePosition', e.target.value)}
          placeholder="Puesto responsable"
          className={inputCls}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.requiresSupervisor ?? form.mode === 'INSPECTION'}
          onChange={(e) => set('requiresSupervisor', e.target.checked)}
        />
        Requiere validación del encargado (&ldquo;Aprobado por&rdquo;)
      </label>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="font-semibold">Ítems</h4>
          <button type="button" onClick={addItem} className="flex min-h-[40px] items-center gap-1 rounded-lg px-3 text-[var(--primary)] hover:bg-[var(--surface-container)]">
            <Plus className="h-4 w-4" /> Añadir ítem
          </button>
        </div>
        <div className="space-y-2">
          {form.items.map((item, idx) => (
            <SictedTemplateItemEditor key={idx} item={item} mode={form.mode} onChange={(i) => updateItem(idx, i)} onRemove={() => removeItem(idx)} />
          ))}
        </div>
      </div>

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
