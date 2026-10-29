'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDaysIso, formatWeekRange, mondayOf } from '../../turnos/components/week-utils';

/** Lunes (AAAA-MM-DD) de la semana actual. */
export const currentWeekStart = () => mondayOf(new Date());

/**
 * Selector de semana (lunes a domingo) con flechas. No deja pasar de la
 * semana actual: el registro de jornada solo existe hacia atrás.
 */
export function CheckInWeekPicker({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const isCurrent = value >= currentWeekStart();
  const btn = 'flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--outline-variant)] disabled:opacity-30';
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => onChange(addDaysIso(value, -7))} className={btn} aria-label="Semana anterior">
        <ChevronLeft className="h-5 w-5" />
      </button>
      <span className="min-w-[170px] text-center font-medium">{formatWeekRange(value)}</span>
      <button
        type="button"
        onClick={() => onChange(addDaysIso(value, 7))}
        disabled={isCurrent}
        className={btn}
        aria-label="Semana siguiente"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
