'use client';

import { useMemo, useState } from 'react';
import type { SeasonDay, SeasonHoliday } from '../api/gestion-seasonality-api';
import { formatDay, formatEuros } from '../gestion-format';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const ROW_LABELS = ['L', '', 'X', '', 'V', '', 'D'];
const WEEKDAY = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
/** Cinco tramos de un solo color (magnitud): opacidad del color principal. */
const LEVELS = [0.15, 0.32, 0.5, 0.72, 1];

interface Cell {
  date: string;
  total: number;
  special: string[];
}

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/**
 * Calendario de calor del año, estilo GitHub: una columna por semana (lunes
 * arriba) y cada día coloreado según lo vendido. Los días con fecha especial
 * llevan un borde. Días sin venta, en gris.
 */
export function SalesHeatmap({ year, days, holidays }: { year: number; days: SeasonDay[]; holidays: SeasonHoliday[] }) {
  const { weeks, max, monthStarts } = useMemo(() => {
    const totals = new Map(days.map((d) => [d.date, d.total]));
    const special = new Map<string, string[]>();
    for (const h of holidays) special.set(h.date, [...(special.get(h.date) ?? []), h.name]);
    const start = Date.UTC(year, 0, 1);
    const end = Date.UTC(year, 11, 31);
    const offset = (new Date(start).getUTCDay() + 6) % 7; // lunes = 0
    const cols: (Cell | null)[][] = [];
    const starts: { col: number; month: number }[] = [];
    for (let t = start - offset * 86_400_000, col = 0; t <= end; col++) {
      const week: (Cell | null)[] = [];
      for (let r = 0; r < 7; r++, t += 86_400_000) {
        if (t < start || t > end) {
          week.push(null);
          continue;
        }
        const date = iso(t);
        if (date.endsWith('-01')) starts.push({ col, month: Number(date.slice(5, 7)) - 1 });
        week.push({ date, total: totals.get(date) ?? 0, special: special.get(date) ?? [] });
      }
      cols.push(week);
    }
    return { weeks: cols, max: Math.max(...days.map((d) => d.total), 0), monthStarts: starts };
  }, [year, days, holidays]);

  // En iPad y móvil no hay «title» al pasar el ratón: tocar un día lo enseña debajo.
  const [picked, setPicked] = useState<(Cell & { weekday: string }) | null>(null);
  const describe = (cell: Cell, weekday: string) =>
    `${weekday} ${formatDay(cell.date)} · ${cell.total > 0 ? formatEuros(cell.total) : 'sin venta'}${cell.special.length ? ` · ${cell.special.join(', ')}` : ''}`;

  const level = (total: number) => (total <= 0 || max <= 0 ? -1 : Math.min(4, Math.floor((total / max) * 5)));

  return (
    <div>
      <div className="overflow-x-auto pb-2">
        <div className="inline-block">
          <div className="relative ml-[22px] h-4 text-[10px] text-[var(--on-surface-variant)]">
            {monthStarts.map((m) => (
              <span key={m.month} className="absolute" style={{ left: m.col * 14 }}>
                {MONTHS[m.month]}
              </span>
            ))}
          </div>
          <div className="flex gap-[2px]">
            <div className="mr-1 flex w-4 flex-col gap-[2px] text-[10px] leading-[12px] text-[var(--on-surface-variant)]">
              {ROW_LABELS.map((l, i) => (
                <span key={i} className="h-3">
                  {l}
                </span>
              ))}
            </div>
            {weeks.map((week, c) => (
              <div key={c} className="flex flex-col gap-[2px]">
                {week.map((cell, r) =>
                  cell ? (
                    <button
                      type="button"
                      key={r}
                      title={describe(cell, WEEKDAY[r])}
                      aria-label={describe(cell, WEEKDAY[r])}
                      onClick={() => setPicked({ ...cell, weekday: WEEKDAY[r] })}
                      className={`h-3 w-3 rounded-[3px] ${cell.special.length ? 'ring-1 ring-[var(--on-surface)]' : ''} ${picked?.date === cell.date ? 'outline outline-2 outline-offset-1 outline-[var(--primary)]' : ''}`}
                      style={{
                        background:
                          level(cell.total) < 0
                            ? 'var(--surface-container-high)'
                            : `color-mix(in srgb, var(--primary) ${LEVELS[level(cell.total)] * 100}%, var(--surface-container-high))`,
                      }}
                    />
                  ) : (
                    <div key={r} className="h-3 w-3" />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-2 min-h-5 text-sm text-[var(--on-surface)]" aria-live="polite">
        {picked ? describe(picked, picked.weekday) : <span className="text-[var(--on-surface-variant)]">Toca un día para ver lo vendido.</span>}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--on-surface-variant)]">
        <span>Menos</span>
        {LEVELS.map((l) => (
          <span
            key={l}
            className="inline-block h-3 w-3 rounded-[3px]"
            style={{ background: `color-mix(in srgb, var(--primary) ${l * 100}%, var(--surface-container-high))` }}
          />
        ))}
        <span>Más</span>
        <span className="ml-3 inline-block h-3 w-3 rounded-[3px] ring-1 ring-[var(--on-surface)]" /> festivo o fecha señalada
      </div>
    </div>
  );
}
