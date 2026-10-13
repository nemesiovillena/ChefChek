import type { DayComparisonFlag, DayComparisonStatus, PlanVsActualRow } from '@/lib/turnos-types';

const STATUS_LABELS: Record<DayComparisonStatus, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'Trabajando',
  OK: 'Correcto',
  NO_SHOW: 'Sin fichar',
  INCIDENT: 'Con incidencia',
  UNPLANNED: 'Sin turno',
};

const STATUS_CLS: Record<DayComparisonStatus, string> = {
  PENDING: 'bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]',
  IN_PROGRESS: 'bg-[var(--primary)] text-primary-foreground',
  OK: 'bg-emerald-600 text-white',
  NO_SHOW: 'bg-[var(--error)] text-[var(--on-error)]',
  INCIDENT: 'bg-amber-500 text-black',
  UNPLANNED: 'bg-[var(--surface-container-high)] text-[var(--on-surface)]',
};

/** 25 -> "25 min"; 95 -> "1 h 35 min". */
const duration = (minutes: number) =>
  minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`.replace(' 0 min', '');

const flagText = (flag: DayComparisonFlag, row: PlanVsActualRow) =>
  ({
    LATE: `Retraso de ${duration(row.lateMinutes)}`,
    EARLY_LEAVE: `Salió ${duration(row.earlyLeaveMinutes)} antes`,
    OVER: `${duration(row.overMinutes)} de más`,
  })[flag];

/** Estado de un turno frente a lo fichado, con el detalle de sus incidencias. */
export function PlanVsActualStatus({ row }: { row: PlanVsActualRow }) {
  // Con incidencias, el detalle dice más que la etiqueta genérica.
  const showStatus = row.status !== 'INCIDENT';
  return (
    <span className="flex flex-wrap items-center gap-1">
      {showStatus && (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[row.status]}`}>
          {STATUS_LABELS[row.status]}
        </span>
      )}
      {row.flags.map((flag) => (
        <span key={flag} className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS.INCIDENT}`}>
          {flagText(flag, row)}
        </span>
      ))}
    </span>
  );
}
