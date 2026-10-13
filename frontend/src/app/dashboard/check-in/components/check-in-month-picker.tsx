'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MONTH_NAMES } from '@/lib/check-in-punch';

export interface YearMonth {
  year: number;
  month: number;
}

export const currentYearMonth = (): YearMonth => {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
};

const shift = ({ year, month }: YearMonth, delta: number): YearMonth => {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
};

/**
 * Selector de mes con flechas. Por defecto no deja ir más allá del mes actual
 * (registro de jornada); `allowFuture` lo permite (ausencias y turnos se
 * planifican por adelantado).
 */
export function CheckInMonthPicker({
  value,
  onChange,
  allowFuture = false,
}: {
  value: YearMonth;
  onChange: (next: YearMonth) => void;
  allowFuture?: boolean;
}) {
  const now = currentYearMonth();
  const isCurrent = !allowFuture && value.year === now.year && value.month === now.month;
  const btn = 'flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--outline-variant)] disabled:opacity-30';
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => onChange(shift(value, -1))} className={btn} aria-label="Mes anterior">
        <ChevronLeft className="h-5 w-5" />
      </button>
      <span className="min-w-[150px] text-center font-medium capitalize">
        {MONTH_NAMES[value.month - 1]} {value.year}
      </span>
      <button type="button" onClick={() => onChange(shift(value, 1))} disabled={isCurrent} className={btn} aria-label="Mes siguiente">
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
