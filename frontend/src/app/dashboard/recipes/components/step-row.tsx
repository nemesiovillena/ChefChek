'use client';

import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import EquipmentCombobox from './equipment-combobox';

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

export default function StepRow({ step, index, total, onChange, onRemove, onMoveUp, onMoveDown }: StepRowProps) {
  const update = (field: keyof ElaborationStep, value: string | null) => {
    onChange(index, { ...step, [field]: value || null });
  };

  return (
    <div className="flex gap-2 items-start p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
      {/* Step number */}
      <div className="flex flex-col items-center gap-1 pt-1">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 text-xs font-bold">
          {index + 1}
        </span>
        <div className="flex flex-col gap-0.5 mt-1">
          {index > 0 && (
            <button
              type="button"
              onClick={() => onMoveUp(index)}
              className="p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer"
              title="Mover arriba"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
          )}
          {index < total - 1 && (
            <button
              type="button"
              onClick={() => onMoveDown(index)}
              className="p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer"
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
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 resize-none"
        />
        <div className="flex gap-2">
          <div className="w-[160px]">
            <EquipmentCombobox
              value={step.equipment || ''}
              onValueChange={(val) => update('equipment', val)}
            />
          </div>
          <input
            type="text"
            value={step.time || ''}
            onChange={(e) => update('time', e.target.value)}
            placeholder="Tiempo (3', 20 min)"
            className="w-[120px] px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
          <input
            type="text"
            value={step.temperature || ''}
            onChange={(e) => update('temperature', e.target.value)}
            placeholder="Temp (60º, 180ºC)"
            className="w-[120px] px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Remove button */}
      {total > 1 && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="p-1.5 text-red-400 hover:text-red-600 dark:hover:text-red-400 mt-1 cursor-pointer"
          title="Eliminar paso"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
