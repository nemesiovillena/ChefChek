'use client';

import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';

export interface ElaborationStep {
  description: string;
  equipment?: string | null;
  time?: string | null;
  temperature?: string | null;
}

interface StepRowProps {
  step: ElaborationStep;
  index: number;
  total: number;
  onChange: (index: number, step: ElaborationStep) => void;
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}

// Campo outlined Material 3 (tokens del proyecto; .dark los redefine).
const inputBase =
  'rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] text-sm text-[var(--on-surface)] placeholder:text-[var(--on-surface-variant)] focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30 transition-colors';

export default function StepRow({ step, index, total, onChange, onRemove, onMoveUp, onMoveDown }: StepRowProps) {
  const update = (field: keyof ElaborationStep, value: string | null) => {
    onChange(index, { ...step, [field]: value || null });
  };

  return (
    <div className="flex gap-2 items-start p-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)]">
      {/* Step number */}
      <div className="flex flex-col items-center gap-1 pt-1">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[var(--primary)]/15 text-[var(--primary)] text-xs font-bold">
          {index + 1}
        </span>
        <div className="flex flex-col gap-0.5 mt-1">
          {index > 0 && (
            <button
              type="button"
              onClick={() => onMoveUp(index)}
              className="p-0.5 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] cursor-pointer"
              title="Mover arriba"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
          )}
          {index < total - 1 && (
            <button
              type="button"
              onClick={() => onMoveDown(index)}
              className="p-0.5 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] cursor-pointer"
              title="Mover abajo"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Step fields */}
      <div className="flex-1 grid grid-cols-1 gap-2">
        <textarea
          value={step.description}
          onChange={(e) => update('description', e.target.value)}
          placeholder="Descripción del paso..."
          rows={2}
          className={`w-full px-3 py-2 resize-none ${inputBase}`}
        />
        <div className="flex gap-2">
          <div className="w-[160px]">
            <input
              type="text"
              value={step.equipment || ''}
              onChange={(e) => update('equipment', e.target.value)}
              placeholder="Equipo"
              className={`w-full px-2 py-1.5 ${inputBase}`}
            />
          </div>
          <input
            type="text"
            value={step.time || ''}
            onChange={(e) => update('time', e.target.value)}
            placeholder="Tiempo (3', 20 min)"
            className={`w-[120px] px-2 py-1.5 ${inputBase}`}
          />
          <input
            type="text"
            value={step.temperature || ''}
            onChange={(e) => update('temperature', e.target.value)}
            placeholder="Temp (60º, 180ºC)"
            className={`w-[120px] px-2 py-1.5 ${inputBase}`}
          />
        </div>
      </div>

      {/* Remove button */}
      {total > 1 && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="p-1.5 mt-1 rounded-lg text-[var(--error)] hover:bg-[var(--error)]/10 cursor-pointer"
          title="Eliminar paso"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
