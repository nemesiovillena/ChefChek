'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Pencil, Plus } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useAckOwnTimesheet } from '@/hooks/use-check-in';
import {
  INCIDENCE_LABELS,
  MONTH_NAMES,
  PUNCH_LABELS,
  formatDay,
  formatMinutes,
  formatTimeIn,
} from '@/lib/check-in-punch';
import type { MonthState, Workday, WorkdayAbsence } from '@/lib/check-in-types';
import { CheckInAdjustmentForm } from './check-in-adjustment-form';
import { cardCls, errorMessage, primaryBtnCls } from './check-in-form-styles';

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });

function Stat({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div>
      <p className="text-sm text-[var(--on-surface-variant)]">{label}</p>
      <p className={`text-xl font-semibold ${alert ? 'text-[var(--error)]' : ''}`}>{value}</p>
    </div>
  );
}

/** Mismo criterio que el contador del backend: un día abierto también cuenta como incidencia. */
const hasIncidence = (day: Workday) => day.incidences.length > 0 || day.open;
const dayAnchorId = (date: string) => `jornada-${date}`;

/** Etiqueta de un día de ausencia con el color de su tipo. */
function AbsenceBadge({ absence }: { absence: WorkdayAbsence }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--outline-variant)] px-2 py-0.5 text-sm">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: absence.color }} />
      {absence.typeName}
      {absence.halfDay && ' (media jornada)'}
    </span>
  );
}

/** Día sin fichajes cubierto por una ausencia aprobada. */
function AbsenceRow({ absence }: { absence: WorkdayAbsence }) {
  return (
    <li id={dayAnchorId(absence.date)} className="flex flex-wrap items-center justify-between gap-2 py-3">
      <p className="font-medium capitalize">{formatDay(absence.date)}</p>
      <AbsenceBadge absence={absence} />
    </li>
  );
}

/** Cuánto dura el resaltado del día al que lleva el contador de incidencias. */
const HIGHLIGHT_MS = 2500;

function DayRow({
  day,
  absence,
  state,
  mode,
  highlighted,
  onScrolledTo,
}: {
  day: Workday;
  absence?: WorkdayAbsence;
  state: MonthState;
  mode: 'own' | 'manager';
  highlighted: boolean;
  /** Llevar este día a la vista al pintarlo (viene de un aviso); se llama una sola vez. */
  onScrolledTo?: () => void;
}) {
  // Qué corrección está abierta en este día: un fichaje concreto, 'new' o ninguna.
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const tz = state.timezone;
  const work = day.segments.filter((s) => s.kind === 'WORK');
  const target = editing && editing !== 'new' ? day.punches.find((p) => p.id === editing) : undefined;

  return (
    <li
      id={dayAnchorId(day.date)}
      ref={
        onScrolledTo
          ? (el) => {
              if (!el) return;
              el.scrollIntoView({ block: 'center' });
              onScrolledTo();
            }
          : undefined
      }
      className={`scroll-mt-24 py-3 transition-colors duration-500 ${
        highlighted ? '-mx-2 rounded-lg bg-[var(--error-container)] px-2' : ''
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="flex flex-wrap items-center gap-2 font-medium capitalize">
          {formatDay(day.date)}
          {absence && <AbsenceBadge absence={absence} />}
        </p>
        <p className="font-semibold">
          {day.open ? 'En curso' : formatMinutes(day.workedMinutes)}
          {day.breakMinutes > 0 && (
            <span className="ml-2 text-sm font-normal text-[var(--on-surface-variant)]">
              pausa {formatMinutes(day.breakMinutes)}
            </span>
          )}
        </p>
      </div>
      <p className="text-sm text-[var(--on-surface-variant)]">
        {work.length > 0
          ? work.map((s) => `${formatTimeIn(s.start, tz)}–${formatTimeIn(s.end, tz)}`).join(' · ')
          : 'Sin tramos completos'}
      </p>
      {day.incidences.map((incidence) => (
        <p key={incidence} className="mt-1 flex items-center gap-1 text-sm text-[var(--error)]">
          <AlertTriangle className="h-4 w-4" /> {INCIDENCE_LABELS[incidence] ?? incidence}
        </p>
      ))}
      {day.open && (
        <p className="mt-1 flex items-center gap-1 text-sm text-[var(--error)]">
          <AlertTriangle className="h-4 w-4" /> Jornada sin cerrar: falta fichar la salida
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        {day.punches.map((punch) => (
          <button
            key={punch.id}
            type="button"
            onClick={() => setEditing(editing === punch.id ? null : punch.id)}
            disabled={punch.voided}
            title={punch.voided ? 'Anulado por una corrección' : 'Corregir este fichaje'}
            className={`flex min-h-[36px] items-center gap-1 rounded-lg border border-[var(--outline-variant)] px-2 text-sm ${
              punch.voided ? 'line-through opacity-50' : ''
            } ${editing === punch.id ? 'bg-[var(--surface-container-high)]' : ''}`}
          >
            {PUNCH_LABELS[punch.type]} {formatTimeIn(punch.occurredAt, tz)}
            {punch.origin === 'ADJUSTMENT' && <span className="text-[var(--on-surface-variant)]">(corrección)</span>}
            {punch.needsReview && <span className="text-[var(--error)]">(a revisar)</span>}
            {!punch.voided && <Pencil className="h-3 w-3 text-[var(--on-surface-variant)]" />}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setEditing(editing === 'new' ? null : 'new')}
          className="flex min-h-[36px] items-center gap-1 rounded-lg border border-dashed border-[var(--outline-variant)] px-2 text-sm"
        >
          <Plus className="h-3 w-3" /> Añadir fichaje
        </button>
      </div>

      {editing && (
        <CheckInAdjustmentForm
          key={editing}
          mode={mode}
          employeeId={state.employee.id}
          date={day.date}
          timezone={tz}
          target={target}
          onDone={() => setEditing(null)}
        />
      )}
    </li>
  );
}

/** Estado de la hoja del mes: aprobada o no, y la conformidad del empleado. */
function SheetStatus({ state, mode }: { state: MonthState; mode: 'own' | 'manager' }) {
  const notify = useNotification();
  const ack = useAckOwnTimesheet();
  const { approved } = state;

  if (!approved) {
    return <p className="text-sm text-[var(--on-surface-variant)]">Hoja del mes sin aprobar todavía.</p>;
  }

  async function handleAck() {
    try {
      await ack.mutateAsync({ year: state.year, month: state.month });
      notify({ type: 'success', title: 'Conformidad registrada', message: '' });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }

  return (
    <div className="space-y-2 text-sm">
      <p className="flex items-start gap-2 text-[var(--primary)]">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        Hoja aprobada por {approved.approvedByName} el {formatDateTime(approved.approvedAt)}
        {approved.version > 1 && ` (versión ${approved.version}: ${approved.reopenReason})`}. Total aprobado:{' '}
        {formatMinutes(approved.workedMinutes)}.
      </p>
      {state.changedSinceApproval && (
        <p className="flex items-start gap-2 text-[var(--error)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Ha habido cambios después de aprobarla: los totales de abajo ya no coinciden con la hoja aprobada.
        </p>
      )}
      {state.acknowledgedAt ? (
        <p className="text-[var(--on-surface-variant)]">
          Conformidad del empleado: {formatDateTime(state.acknowledgedAt)}.
        </p>
      ) : mode === 'own' ? (
        <button type="button" onClick={handleAck} disabled={ack.isPending} className={primaryBtnCls}>
          {ack.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Estoy conforme con esta hoja
        </button>
      ) : (
        <p className="text-[var(--on-surface-variant)]">El empleado aún no ha dado su conformidad.</p>
      )}
    </div>
  );
}

/** Registro de jornada de un mes: totales, estado de la hoja y cada día con sus fichajes. */
export function CheckInMonthView({
  state,
  mode,
  showAddMissingDay = true,
  focusDate,
}: {
  state: MonthState;
  mode: 'own' | 'manager';
  /** Día al que se llega desde un aviso: se resalta y se lleva a la vista. */
  focusDate?: string;
  /** El local puede ocultar al empleado el alta de un día sin fichajes. */
  showAddMissingDay?: boolean;
}) {
  const [addingDay, setAddingDay] = useState('');
  const [highlightedDate, setHighlightedDate] = useState<string | null>(focusDate ?? null);
  // El día del aviso se lleva a la vista una vez; luego el usuario manda.
  const [pendingScroll, setPendingScroll] = useState(focusDate);
  const { totals } = state;
  // Días con fichajes y días de ausencia sin fichajes, juntos y por fecha.
  const absenceByDate = new Map(state.absences.map((a) => [a.date, a]));
  const dayDates = new Set(state.days.map((d) => d.date));
  const rows = [
    ...state.days.map((day) => ({ date: day.date, day })),
    ...state.absences.filter((a) => !dayDates.has(a.date)).map((absence) => ({ date: absence.date, absence })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const pad = (n: number) => String(n).padStart(2, '0');
  const monthPrefix = `${state.year}-${pad(state.month)}-`;
  const lastDay = new Date(state.year, state.month, 0).getDate();

  /**
   * Lleva al primer día con incidencia y lo resalta un momento: si el día ya
   * está a la vista, el desplazamiento no se nota y el resaltado indica cuál es.
   */
  function goToFirstIncidence() {
    const day = state.days.find(hasIncidence);
    if (!day) return;
    document.getElementById(dayAnchorId(day.date))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedDate(day.date);
    setTimeout(() => setHighlightedDate((current) => (current === day.date ? null : current)), HIGHLIGHT_MS);
  }

  return (
    <div className="space-y-4">
      <div className={`${cardCls} space-y-4`}>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Trabajado" value={formatMinutes(totals.workedMinutes)} />
          <Stat
            label="Jornada pactada del mes"
            value={totals.expectedMinutes === null ? 'Sin pactar' : formatMinutes(totals.expectedMinutes)}
          />
          <Stat
            label="Exceso (estimado)"
            value={totals.overtimeMinutes === null ? '—' : formatMinutes(totals.overtimeMinutes)}
          />
          {totals.incidenceCount > 0 ? (
            <button
              type="button"
              onClick={() => goToFirstIncidence()}
              title="Ver el día con incidencia"
              className="text-left"
            >
              <p className="text-sm text-[var(--on-surface-variant)]">Días con incidencia</p>
              <p className="text-xl font-semibold text-[var(--error)] underline underline-offset-4">
                {totals.incidenceCount}
              </p>
            </button>
          ) : (
            <Stat label="Días con incidencia" value="0" />
          )}
        </div>
        <p className="text-sm text-[var(--on-surface-variant)]">
          El exceso compara lo trabajado con las horas semanales pactadas repartidas en el mes. El cómputo definitivo de
          horas extraordinarias depende del convenio.
        </p>
        {totals.absenceDays > 0 && (
          <p className="text-sm text-[var(--on-surface-variant)]">
            {String(totals.absenceDays).replace('.', ',')} día{totals.absenceDays === 1 ? '' : 's'} de ausencia
            aprobada (vacaciones, bajas o permisos): la jornada pactada del mes ya los descuenta.
          </p>
        )}
        <SheetStatus state={state} mode={mode} />
        {state.pendingAdjustments > 0 && (
          <p className="text-sm text-[var(--error)]">
            {state.pendingAdjustments} solicitud{state.pendingAdjustments === 1 ? '' : 'es'} de corrección pendiente
            {state.pendingAdjustments === 1 ? '' : 's'} de respuesta.
          </p>
        )}
      </div>

      <div className={cardCls}>
        {rows.length === 0 ? (
          <p className="text-[var(--on-surface-variant)]">
            Sin fichajes en {MONTH_NAMES[state.month - 1]} de {state.year}.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--outline-variant)]">
            {rows.map((row) =>
              'day' in row && row.day ? (
                <DayRow
                  key={row.date}
                  day={row.day}
                  absence={absenceByDate.get(row.date)}
                  state={state}
                  mode={mode}
                  highlighted={row.date === highlightedDate}
                  onScrolledTo={row.date === pendingScroll ? () => setPendingScroll(undefined) : undefined}
                />
              ) : (
                <AbsenceRow key={row.date} absence={absenceByDate.get(row.date) as WorkdayAbsence} />
              ),
            )}
          </ul>
        )}

        {/* Un día sin ningún fichaje no aparece en la lista: se elige aquí. */}
        {showAddMissingDay && (
          <div className="mt-4 border-t border-[var(--outline-variant)] pt-4">
            <label className="flex flex-wrap items-center gap-2 text-sm">
              ¿Falta un día entero? Añadir fichaje el día
              <input
                type="date"
                value={addingDay}
                min={`${monthPrefix}01`}
                max={`${monthPrefix}${pad(lastDay)}`}
                onChange={(e) => setAddingDay(e.target.value)}
                className="min-h-[44px] rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-2 text-base"
              />
            </label>
            {addingDay && (
              <CheckInAdjustmentForm
                key={addingDay}
                mode={mode}
                employeeId={state.employee.id}
                date={addingDay}
                timezone={state.timezone}
                onDone={() => setAddingDay('')}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
