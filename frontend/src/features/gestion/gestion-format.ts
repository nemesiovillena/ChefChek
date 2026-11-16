import type { Bucket, GestionCell, GestionColumnKind } from './api/gestion-api';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

export const formatEuros = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });

/** Euros sin céntimos para ejes y cifras grandes. */
export const formatEurosShort = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export const formatQty = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 2 });

export const formatDay = (iso: string) => iso.split('-').reverse().join('/');

/** Etiqueta corta de un tramo de la gráfica: «lun 12/10», «sem. 12/10», «oct 2026». */
export function formatBucket(key: string, bucket: Bucket): string {
  const [y, m, d] = key.split('-');
  if (bucket === 'month') return `${MONTHS[Number(m) - 1]} ${y}`;
  if (bucket === 'week') return `sem. ${d}/${m}`;
  const weekday = WEEKDAYS[new Date(`${key}T00:00:00`).getDay()];
  return `${weekday} ${d}/${m}`;
}

export function formatCell(kind: GestionColumnKind, value: GestionCell): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string') return value;
  switch (kind) {
    case 'euros':
      return formatEuros(value);
    case 'percent':
      return `${value.toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`;
    case 'int':
      return value.toLocaleString('es-ES', { maximumFractionDigits: 0 });
    default:
      return formatQty(value);
  }
}

/**
 * Importe escrito a la española: «1.200», «1.234,56», «12,5» o «-80».
 * Con coma, los puntos son de miles; sin coma, un punto seguido de 3 cifras
 * también lo es («1.200» = 1200). Devuelve NaN si no se entiende.
 */
export function parseEsAmount(text: string): number {
  const t = text.trim().replace(/\s|€/g, '');
  if (!/^-?[\d.,]+$/.test(t)) return NaN;
  let normalized: string;
  if (t.includes(',')) {
    normalized = t.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) {
    normalized = t.replace(/\./g, '');
  } else {
    normalized = t;
  }
  return /^-?\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : NaN;
}
