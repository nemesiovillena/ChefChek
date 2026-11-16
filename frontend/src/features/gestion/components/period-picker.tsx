'use client';

import { RANGE_PRESETS, type RangePreset, presetRange } from '@/lib/cuiner-sales-report-ranges';
import { inputCls, labelCls } from '@/app/dashboard/check-in/components/check-in-form-styles';
import type { CompareMode, DateRange } from '../api/gestion-api';

interface Props {
  preset: RangePreset;
  range: DateRange;
  onChange: (preset: RangePreset, range: DateRange) => void;
  compare?: CompareMode;
  onCompareChange?: (mode: CompareMode) => void;
}

/** Periodo rápido + las dos fechas siempre a la vista (+ comparación opcional). */
export function PeriodPicker({ preset, range, onChange, compare, onCompareChange }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex min-w-[10rem] flex-1 flex-col">
        <span className={labelCls}>Periodo</span>
        <select
          className={inputCls}
          value={preset}
          onChange={(e) => {
            const next = e.target.value as RangePreset;
            onChange(next, next === 'custom' ? range : presetRange(next));
          }}
        >
          {RANGE_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-[9rem] flex-1 flex-col">
        <span className={labelCls}>Desde</span>
        <input
          type="date"
          className={inputCls}
          value={range.from}
          onChange={(e) => e.target.value && onChange('custom', { ...range, from: e.target.value })}
        />
      </label>
      <label className="flex min-w-[9rem] flex-1 flex-col">
        <span className={labelCls}>Hasta</span>
        <input
          type="date"
          className={inputCls}
          value={range.to}
          onChange={(e) => e.target.value && onChange('custom', { ...range, to: e.target.value })}
        />
      </label>
      {compare && onCompareChange && (
        <label className="flex min-w-[10rem] flex-1 flex-col">
          <span className={labelCls}>Comparar con</span>
          <select className={inputCls} value={compare} onChange={(e) => onCompareChange(e.target.value as CompareMode)}>
            <option value="year">Mismo periodo del año anterior</option>
            <option value="previous">Periodo anterior</option>
          </select>
        </label>
      )}
    </div>
  );
}
