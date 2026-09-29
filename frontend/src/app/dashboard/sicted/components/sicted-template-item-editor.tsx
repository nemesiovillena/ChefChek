'use client';

import { GripVertical, Trash2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ChecklistMode, ChecklistTemplateItemInput } from '@/lib/sicted-types';

interface SictedTemplateItemEditorProps {
  sortableId: string;
  item: ChecklistTemplateItemInput;
  mode: ChecklistMode;
  onChange: (item: ChecklistTemplateItemInput) => void;
  onRemove: () => void;
}

const inputCls =
  'min-h-[48px] w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-base';

/** Un ítem dentro del editor de plantilla: etiqueta, procedimiento, producto/dosis/EPI, rango y valor habitual (solo MEASUREMENT). */
export function SictedTemplateItemEditor({ sortableId, item, mode, onChange, onRemove }: SictedTemplateItemEditorProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`space-y-2 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-3 ${
        isDragging ? 'relative z-10 shadow-lg' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        {/* Asa de arrastre (solo escritorio): la tarjeta entera no arrastra para poder escribir en sus campos. */}
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="hidden h-10 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)] active:cursor-grabbing md:flex"
          aria-label="Mover ítem"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <input
          value={item.label}
          onChange={(e) => onChange({ ...item, label: e.target.value })}
          placeholder="Elemento (ej. Suelo de cámara de frío)"
          className={inputCls}
        />
        <button
          type="button"
          onClick={onRemove}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--error)] hover:bg-[var(--error-container)]"
          aria-label="Quitar ítem"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <textarea
        value={item.procedure ?? ''}
        onChange={(e) => onChange({ ...item, procedure: e.target.value })}
        placeholder="Procedimiento paso a paso…"
        className={`${inputCls} min-h-[64px] py-2`}
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <input
          value={(item.products ?? []).join(', ')}
          onChange={(e) =>
            onChange({ ...item, products: e.target.value.split(',').map((p) => p.trim()).filter(Boolean) })
          }
          placeholder="Productos (coma)"
          className={inputCls}
        />
        <input
          value={item.dosage ?? ''}
          onChange={(e) => onChange({ ...item, dosage: e.target.value })}
          placeholder="Dosificación"
          className={inputCls}
        />
        <input
          value={item.epi ?? ''}
          onChange={(e) => onChange({ ...item, epi: e.target.value })}
          placeholder="EPI"
          className={inputCls}
        />
      </div>

      {mode === 'MEASUREMENT' && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={item.expectedRangeMin ?? ''}
            onChange={(e) => onChange({ ...item, expectedRangeMin: e.target.value === '' ? undefined : Number(e.target.value) })}
            placeholder="Mín."
            className={`${inputCls} w-24`}
          />
          <span className="text-sm text-[var(--on-surface-variant)]">a</span>
          <input
            type="number"
            value={item.expectedRangeMax ?? ''}
            onChange={(e) => onChange({ ...item, expectedRangeMax: e.target.value === '' ? undefined : Number(e.target.value) })}
            placeholder="Máx."
            className={`${inputCls} w-24`}
          />
          <span className="ml-2 text-sm text-[var(--on-surface-variant)]">Valor habitual</span>
          <input
            type="number"
            value={item.defaultValue ?? ''}
            onChange={(e) => onChange({ ...item, defaultValue: e.target.value === '' ? undefined : Number(e.target.value) })}
            placeholder="p. ej. 3"
            title="Se rellena solo en «Hojas de hoy»; basta con cambiarlo si la lectura es distinta"
            className={`${inputCls} w-24`}
          />
        </div>
      )}
      {mode === 'MEASUREMENT' &&
        item.defaultValue !== undefined &&
        ((item.expectedRangeMin !== undefined && item.defaultValue < item.expectedRangeMin) ||
          (item.expectedRangeMax !== undefined && item.defaultValue > item.expectedRangeMax)) && (
          <p className="text-xs text-[var(--error)]">
            El valor habitual está fuera del rango: cada día pedirá una acción correctiva. Revisa el valor o el rango.
          </p>
        )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={item.isRequired ?? true}
          onChange={(e) => onChange({ ...item, isRequired: e.target.checked })}
        />
        Obligatorio
      </label>
    </div>
  );
}
