import type { SalesReportGroupBy } from './cuiner-types';

/**
 * Periodos rápidos del informe de ventas. Las fechas son días de caja en la
 * hora local del navegador (la del restaurante), en formato AAAA-MM-DD.
 */

export const RANGE_PRESETS = [
  { id: 'today', label: 'Hoy' },
  { id: 'yesterday', label: 'Ayer' },
  { id: 'thisWeek', label: 'Esta semana' },
  { id: 'lastWeek', label: 'Semana pasada' },
  { id: 'thisMonth', label: 'Este mes' },
  { id: 'lastMonth', label: 'Mes pasado' },
  { id: 'thisYear', label: 'Este año' },
  { id: 'lastYear', label: 'Año pasado' },
  { id: 'custom', label: 'Fechas a mano' },
] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number]['id'];

export const GROUP_BY_OPTIONS: { id: SalesReportGroupBy; label: string }[] = [
  { id: 'day', label: 'Por día' },
  { id: 'week', label: 'Por semana' },
  { id: 'month', label: 'Por mes' },
  { id: 'year', label: 'Por año' },
  { id: 'total', label: 'Total del periodo' },
];

export const LEVEL_OPTIONS = [
  { id: 1, label: 'Familia' },
  { id: 2, label: 'Subfamilia' },
  { id: 3, label: 'Sección' },
  { id: 4, label: 'Plato' },
] as const;

export const DISH_LEVEL = 4;

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Lunes de la semana de `d` (la semana va de lunes a domingo). */
const monday = (d: Date) => {
  const m = new Date(d);
  m.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return m;
};

const shift = (d: Date, days: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
};

export function presetRange(preset: Exclude<RangePreset, 'custom'>, now = new Date()): { from: string; to: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case 'today':
      return { from: iso(now), to: iso(now) };
    case 'yesterday': {
      const d = shift(now, -1);
      return { from: iso(d), to: iso(d) };
    }
    case 'thisWeek':
      return { from: iso(monday(now)), to: iso(shift(monday(now), 6)) };
    case 'lastWeek': {
      const start = shift(monday(now), -7);
      return { from: iso(start), to: iso(shift(start, 6)) };
    }
    case 'thisMonth':
      return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
    case 'lastMonth':
      return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case 'thisYear':
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    case 'lastYear':
      return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
  }
}

/** Agrupación que tiene sentido por defecto para cada periodo rápido. */
export function defaultGroupBy(preset: RangePreset): SalesReportGroupBy {
  if (preset === 'today' || preset === 'yesterday') return 'total';
  if (preset === 'thisWeek' || preset === 'lastWeek' || preset === 'thisMonth' || preset === 'lastMonth') return 'day';
  if (preset === 'thisYear' || preset === 'lastYear') return 'month';
  return 'total';
}

export const formatEuros = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
export const formatQty = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 2 });
/** «2026-10-17» → «17/10/2026» */
export const formatDay = (isoDay: string) => isoDay.split('-').reverse().join('/');
