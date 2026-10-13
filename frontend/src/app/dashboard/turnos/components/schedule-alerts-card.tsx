import { AlertTriangle } from 'lucide-react';
import type { ScheduleAlert } from '@/lib/turnos-types';
import { cardCls } from '../../check-in/components/check-in-form-styles';
import { formatWeekday } from './week-utils';

/** Avisos legales de la semana planificada. Orientativos: no impiden guardar ni publicar. */
export function ScheduleAlertsCard({ alerts }: { alerts: ScheduleAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <section className={`${cardCls} space-y-2 border-amber-500/60`} aria-label="Avisos de la semana">
      <h3 className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden />
        {alerts.length} aviso{alerts.length === 1 ? '' : 's'} en esta semana
      </h3>
      <ul className="space-y-1 text-sm">
        {alerts.map((alert) => (
          <li key={`${alert.code}-${alert.employeeId}-${alert.date}`}>
            {alert.date && <span className="font-medium capitalize">{formatWeekday(alert.date)}: </span>}
            {alert.message}
          </li>
        ))}
      </ul>
      <p className="text-sm text-[var(--on-surface-variant)]">
        Son avisos orientativos según los parámetros de convenio de Ajustes de fichaje. No impiden guardar ni publicar.
      </p>
    </section>
  );
}
