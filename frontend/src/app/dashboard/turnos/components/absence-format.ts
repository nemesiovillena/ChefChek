import type { Absence } from '@/lib/turnos-types';

/** "2026-08-03" -> "3 ago". Fecha de calendario, sin zona horaria. */
export const formatDate = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export const formatRange = (absence: Pick<Absence, 'startDate' | 'endDate'>) =>
  absence.startDate === absence.endDate
    ? formatDate(absence.startDate)
    : `${formatDate(absence.startDate)} – ${formatDate(absence.endDate)}`;

/** 0.5 -> "medio día", 1 -> "1 día", 7 -> "7 días". */
export const formatDays = (days: number) =>
  days === 0.5 ? 'medio día' : `${String(days).replace('.', ',')} día${days === 1 ? '' : 's'}`;

export const STATUS_COLORS: Record<Absence['status'], string> = {
  PENDING: 'text-[var(--on-surface-variant)]',
  APPROVED: 'text-[var(--primary)]',
  REJECTED: 'text-[var(--error)]',
  CANCELLED: 'text-[var(--on-surface-variant)] line-through',
};
