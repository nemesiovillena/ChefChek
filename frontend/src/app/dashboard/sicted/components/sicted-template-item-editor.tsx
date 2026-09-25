'use client';

import { Trash2 } from 'lucide-react';
import type { ChecklistMode, ChecklistTemplateItemInput } from '@/lib/sicted-types';

interface SictedTemplateItemEditorProps {
  item: ChecklistTemplateItemInput;
  mode: ChecklistMode;
  onChange: (item: ChecklistTemplateItemInput) => void;
  onRemove: () => void;
}

const inputCls =
  'min-h-[48px] w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-base';

/** Un ítem dentro del editor de plantilla: etiqueta, procedimiento, producto/dosis/EPI, rango (solo MEASUREMENT). */
export function SictedTemplateItemEditor({ item, mode, onChange, onRemove }: SictedTemplateItemEditorProps) {
  return (
    <div className="space-y-2 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-3">
      <div className="flex items-center gap-2">
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
        </div>
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
