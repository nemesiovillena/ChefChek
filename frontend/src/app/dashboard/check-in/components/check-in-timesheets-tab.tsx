'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useConfirm } from '@/contexts/confirm.context';
import { useApproveTimesheet, useTimesheets } from '@/hooks/use-check-in';
import { MONTH_NAMES, formatMinutes } from '@/lib/check-in-punch';
import type { TimesheetRow } from '@/lib/check-in-types';
import { cardCls, errorMessage, inputCls, primaryBtnCls, secondaryBtnCls } from './check-in-form-styles';
import type { YearMonth } from './check-in-month-picker';

function Row({ row, period, onOpen }: { row: TimesheetRow; period: YearMonth; onOpen: (employeeId: string) => void }) {
  const notify = useNotification();
  const confirm = useConfirm();
  const approve = useApproveTimesheet();
  const [reopening, setReopening] = useState(false);
  const [reason, setReason] = useState('');
  const blocked = row.totals.incidenceCount > 0 || row.pendingAdjustments > 0;

  async function handleApprove() {
    if (row.approved && !reason.trim()) {
      notify({ type: 'error', title: 'Falta el motivo', message: 'Indica por qué se vuelve a aprobar.' });
      return;
    }
    const ok = await confirm({
      title: `Aprobar ${MONTH_NAMES[period.month - 1]} de ${row.employeeName}`,
      description: `Se guardará una copia fija del mes con ${formatMinutes(row.totals.workedMinutes)} trabajados. No se podrá modificar; solo aprobar una versión nueva.`,
    });
    if (!ok) return;
    try {
      await approve.mutateAsync({ employeeId: row.employeeId, ...period, reopenReason: reason.trim() || undefined });
      notify({ type: 'success', title: 'Hoja aprobada', message: '' });
      setReopening(false);
      setReason('');
    } catch (err) {
      notify({ type: 'error', title: 'No se pudo aprobar', message: errorMessage(err) });
    }
  }

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => onOpen(row.employeeId)} className="min-w-0 text-left">
          <span className="block truncate font-medium underline">
            {row.employeeName}
            {!row.isActive && ' (baja)'}
          </span>
          <span className="block text-sm text-[var(--on-surface-variant)]">
            {formatMinutes(row.totals.workedMinutes)} en {row.totals.daysWorked} día
            {row.totals.daysWorked === 1 ? '' : 's'} · exceso estimado {formatMinutes(row.totals.overtimeMinutes)}
          </span>
        </button>

        {row.approved && !row.changedSinceApproval ? (
          <span className="flex items-center gap-1 text-sm text-[var(--primary)]">
            <CheckCircle2 className="h-4 w-4" /> Aprobada{row.approved.version > 1 ? ` (v${row.approved.version})` : ''}
            {row.acknowledgedAt ? ' · conforme' : ' · sin conformidad'}
          </span>
        ) : row.approved ? (
          <button type="button" onClick={() => setReopening(true)} className={secondaryBtnCls}>
            Aprobar de nuevo
          </button>
        ) : (
          <button type="button" onClick={handleApprove} disabled={blocked || approve.isPending} className={primaryBtnCls}>
            {approve.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Aprobar
          </button>
        )}
      </div>

      {blocked && (
        <p className="mt-1 flex items-center gap-1 text-sm text-[var(--error)]">
          <AlertTriangle className="h-4 w-4" />
          {[
            row.totals.incidenceCount > 0 && `${row.totals.incidenceCount} día(s) con incidencia`,
            row.pendingAdjustments > 0 && `${row.pendingAdjustments} solicitud(es) pendiente(s)`,
          ]
            .filter(Boolean)
            .join(' · ')}
          . Hay que resolverlo antes de aprobar.
        </p>
      )}
      {row.approved && row.changedSinceApproval && (
        <p className="mt-1 text-sm text-[var(--error)]">
          Ha cambiado desde que se aprobó ({formatMinutes(row.approved.workedMinutes)} aprobados).
        </p>
      )}
      {reopening && (
        <div className="mt-2 space-y-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo de la nueva aprobación"
            className={`${inputCls} min-h-[72px] py-2`}
          />
          <div className="flex gap-2">
            <button type="button" onClick={handleApprove} disabled={blocked || approve.isPending} className={primaryBtnCls}>
              Aprobar versión nueva
            </button>
            <button type="button" onClick={() => setReopening(false)} className={secondaryBtnCls}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

/** Hojas de horas del mes: totales por persona y aprobación. */
export function CheckInTimesheetsTab({ period, onOpen }: { period: YearMonth; onOpen: (employeeId: string) => void }) {
  const { data: rows, isLoading } = useTimesheets(period.year, period.month);
  if (isLoading || !rows) return <p className="text-[var(--on-surface-variant)]">Cargando…</p>;
  if (rows.length === 0) return <p className="text-[var(--on-surface-variant)]">No hay empleados.</p>;
  return (
    <div className={cardCls}>
      <p className="mb-2 text-sm text-[var(--on-surface-variant)]">
        Aprobar guarda una copia fija del mes. Toca un nombre para ver sus jornadas y corregirlas.
      </p>
      <ul className="divide-y divide-[var(--outline-variant)]">
        {rows.map((row) => (
          <Row key={row.employeeId} row={row} period={period} onOpen={onOpen} />
        ))}
      </ul>
    </div>
  );
}
