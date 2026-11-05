'use client';

import { useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, Copy, Loader2, Plus, Send } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useConfirm } from '@/contexts/confirm.context';
import { useWorkCenters } from '@/hooks/use-check-in';
import {
  useCopyWeek,
  useCreateShift,
  usePublishWeek,
  useSaveShiftTemplate,
  useSchedule,
  useUpdateShift,
} from '@/hooks/use-turnos';
import type { Shift, WeekSchedule } from '@/lib/turnos-types';
import {
  cardCls,
  errorMessage,
  inputCls,
  labelCls,
  primaryBtnCls,
  secondaryBtnCls,
} from '../../check-in/components/check-in-form-styles';
import { PlanVsActualView } from './plan-vs-actual-view';
import { ScheduleAlertsCard } from './schedule-alerts-card';
import { ScheduleDayView } from './schedule-day-view';
import { ScheduleGrid } from './schedule-grid';
import { ScheduleMonthView } from './schedule-month-view';
import { ShiftEditor, type EditorTarget } from './shift-editor';
import {
  addDaysIso,
  addMonthsIso,
  formatDayLong,
  formatEuros,
  formatHours,
  formatMonth,
  formatWeekRange,
  mondayOfIso,
  todayIso,
} from './week-utils';

type PlannerView = 'plan' | 'actual';
const VIEWS: { id: PlannerView; label: string }[] = [
  { id: 'plan', label: 'Planificación' },
  { id: 'actual', label: 'Plan frente a real' },
];

/** Cuánto abarca la planificación en pantalla. */
type Span = 'day' | 'week' | 'month';
const SPANS: { id: Span; label: string }[] = [
  { id: 'day', label: 'Día' },
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mes' },
];
const SPAN_NAV: Record<Span, { prev: string; next: string }> = {
  day: { prev: 'Día anterior', next: 'Día siguiente' },
  week: { prev: 'Semana anterior', next: 'Semana siguiente' },
  month: { prev: 'Mes anterior', next: 'Mes siguiente' },
};

const navBtn = 'flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--outline-variant)]';

/** Alta rápida de plantillas de turno ("Mañana 9-17"). */
function TemplatesCard({ schedule }: { schedule: WeekSchedule }) {
  const notify = useNotification();
  const save = useSaveShiftTemplate();
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [breakMinutes, setBreakMinutes] = useState(0);
  const [color, setColor] = useState('#2563eb');

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      notify({ type: 'error', title: 'Falta el nombre', message: '' });
      return;
    }
    try {
      await save.mutateAsync({ data: { name: name.trim(), startTime, endTime, breakMinutes, color } });
      setName('');
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }

  async function handleRemove(id: string) {
    const template = schedule.templates.find((t) => t.id === id);
    if (!template) return;
    try {
      await save.mutateAsync({
        id,
        data: { name: template.name, startTime: template.startTime, endTime: template.endTime, isActive: false },
      });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }

  return (
    <section className={`${cardCls} space-y-3`}>
      <div>
        <h3 className="font-semibold">Plantillas de turno</h3>
        <p className="text-sm text-[var(--on-surface-variant)]">
          Horarios habituales para rellenar un turno con un toque al crearlo.
        </p>
      </div>
      {schedule.templates.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {schedule.templates.map((template) => (
            <li key={template.id} className="flex items-center gap-2 rounded-lg border border-[var(--outline-variant)] px-3 py-1 text-sm">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: template.color }} aria-hidden />
              {template.name} · {template.startTime}–{template.endTime}
              <button type="button" onClick={() => handleRemove(template.id)} className="min-h-[32px] px-1 underline" aria-label={`Quitar ${template.name}`}>
                quitar
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_130px_130px_120px_70px_auto] lg:items-end">
        <label className="block">
          <span className={labelCls}>Nombre</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Mañana" className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Entrada</span>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Salida</span>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Pausa (min)</span>
          <input type="number" min={0} max={600} step={5} value={breakMinutes} onChange={(e) => setBreakMinutes(Number(e.target.value))} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Color</span>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-12 w-full rounded-lg border border-[var(--outline-variant)]" />
        </label>
        <button type="submit" disabled={save.isPending} className={secondaryBtnCls}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Añadir
        </button>
      </form>
    </section>
  );
}

/** Planificador semanal de turnos de un centro. Solo gerencia. */
export function SchedulePlanner() {
  const notify = useNotification();
  const confirm = useConfirm();
  const { data: centers } = useWorkCenters();
  // Fecha de referencia: el día que se ve, o uno de la semana o del mes.
  const [day, setDay] = useState(todayIso);
  const [chosenSpan, setSpan] = useState<Span>('week');
  const [chosenCenter, setChosenCenter] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditorTarget | null>(null);
  const [duplicate, setDuplicate] = useState(false);
  const [view, setView] = useState<PlannerView>('plan');
  // Plan frente a real solo existe por semanas.
  const span: Span = view === 'actual' ? 'week' : chosenSpan;
  const weekStart = mondayOfIso(day);

  const activeCenters = (centers ?? []).filter((c) => c.isActive);
  // Sin elegir, el centro principal.
  const locationId = chosenCenter ?? activeCenters.find((c) => c.isDefault)?.id ?? activeCenters[0]?.id ?? null;
  const { data: schedule, isLoading } = useSchedule(locationId, weekStart);
  const update = useUpdateShift(locationId, weekStart);
  const create = useCreateShift();
  const copyWeek = useCopyWeek();
  const publish = usePublishWeek();

  function goTo(next: string) {
    setEditing(null);
    setDay(next);
  }

  function step(direction: 1 | -1) {
    if (span === 'day') goTo(addDaysIso(day, direction));
    else if (span === 'week') goTo(addDaysIso(day, 7 * direction));
    else goTo(addMonthsIso(day, direction));
  }

  function openDay(date: string) {
    setSpan('day');
    goTo(date);
  }

  async function handleDrop(shift: Shift, employeeId: string | null, date: string) {
    try {
      if (duplicate) {
        await create.mutateAsync({
          locationId: shift.locationId,
          employeeId,
          date,
          startTime: shift.startTime,
          endTime: shift.endTime,
          breakMinutes: shift.breakMinutes,
          color: shift.color ?? undefined,
          note: shift.note ?? undefined,
        });
      } else {
        await update.mutateAsync({ id: shift.id, data: { employeeId, date } });
      }
    } catch (err) {
      notify({ type: 'error', title: duplicate ? 'No se pudo duplicar' : 'No se pudo mover', message: errorMessage(err) });
    }
  }

  async function handleCopyPrevious() {
    if (!locationId) return;
    const ok = await confirm({
      title: 'Copiar la semana anterior',
      description:
        'Se añaden a esta semana, como borradores, los turnos de la última semana planificada antes de esta (aunque haya semanas vacías en medio). Los que no encajen (ausencias, personas de baja, turnos que se pisan) se saltan.',
    });
    if (!ok) return;
    try {
      const result = await copyWeek.mutateAsync({ locationId, toWeekStart: weekStart });
      if (!result.fromWeekStart) {
        notify({ type: 'warning', title: 'Nada que copiar', message: 'No hay ninguna semana anterior con turnos.' });
        return;
      }
      const source = `de la semana ${formatWeekRange(result.fromWeekStart)}`;
      notify({
        type: result.copied > 0 ? 'success' : 'warning',
        title: `${result.copied} turno${result.copied === 1 ? '' : 's'} copiado${result.copied === 1 ? '' : 's'} ${source}`,
        message:
          result.skipped > 0
            ? `${result.skipped} no se copiaron porque no encajan en esta semana (ausencia, persona de baja o ya hay un turno a esa hora).`
            : '',
      });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }

  async function handlePublish() {
    if (!locationId || !schedule) return;
    const ok = await confirm({
      title: 'Publicar la semana',
      description: `${schedule.draftCount} turno${schedule.draftCount === 1 ? '' : 's'} en borrador pasarán a verlos sus personas asignadas.`,
    });
    if (!ok) return;
    try {
      const result = await publish.mutateAsync({ locationId, weekStart });
      notify({ type: 'success', title: 'Semana publicada', message: `${result.published} turnos publicados.` });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }

  if (centers && activeCenters.length === 0) {
    return <p className="text-[var(--on-surface-variant)]">No hay centros de trabajo activos.</p>;
  }

  const totalMinutes = schedule?.shifts.filter((s) => s.employeeId).reduce((sum, s) => sum + s.workMinutes, 0) ?? 0;
  const editorKey = editing ? ('shift' in editing ? editing.shift.id : `new-${editing.employeeId}-${editing.date}`) : '';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => step(-1)} className={navBtn} aria-label={SPAN_NAV[span].prev}>
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="min-w-[170px] text-center font-medium first-letter:uppercase">
            {span === 'day' ? formatDayLong(day) : span === 'month' ? formatMonth(day) : formatWeekRange(weekStart)}
          </span>
          <button type="button" onClick={() => step(1)} className={navBtn} aria-label={SPAN_NAV[span].next}>
            <ChevronRight className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => goTo(todayIso())} className="min-h-[44px] px-2 text-sm underline">
            Hoy
          </button>
          {view === 'plan' && (
            <div role="group" aria-label="Periodo" className="flex rounded-xl border border-[var(--outline-variant)] p-0.5">
              {SPANS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={span === id}
                  onClick={() => {
                    setEditing(null);
                    setSpan(id);
                  }}
                  className={`min-h-[40px] rounded-lg px-3 text-sm font-medium ${
                    span === id ? 'bg-[var(--primary)] text-primary-foreground' : 'text-[var(--on-surface-variant)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        {activeCenters.length > 1 && (
          <select
            value={locationId ?? ''}
            onChange={(e) => {
              setEditing(null);
              setChosenCenter(e.target.value);
            }}
            aria-label="Centro"
            className="min-h-[44px] rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-base"
          >
            {activeCenters.map((center) => (
              <option key={center.id} value={center.id}>
                {center.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* role=tablist: globals.css oculta los <nav> que no son fijos. */}
      <div role="tablist" aria-label="Vista" className="flex gap-1 overflow-x-auto rounded-2xl bg-[var(--surface-container)] p-1">
        {VIEWS.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            aria-selected={view === id}
            onClick={() => {
              setEditing(null);
              setView(id);
            }}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition ${
              view === id
                ? 'bg-[var(--primary)] text-primary-foreground'
                : 'text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'actual' ? (
        locationId && <PlanVsActualView locationId={locationId} weekStart={weekStart} />
      ) : span === 'month' ? (
        locationId && <ScheduleMonthView locationId={locationId} date={day} onOpenDay={openDay} />
      ) : isLoading || !schedule ? (
        <p className="text-[var(--on-surface-variant)]">Cargando…</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={handlePublish} disabled={schedule.draftCount === 0 || publish.isPending} className={primaryBtnCls}>
              {publish.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {schedule.draftCount > 0
                ? `Publicar la semana (${schedule.draftCount} sin publicar)`
                : 'Semana publicada'}
            </button>
            <button type="button" onClick={handleCopyPrevious} disabled={copyWeek.isPending} className={secondaryBtnCls}>
              {copyWeek.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
              Copiar semana anterior
            </button>
            <label className="flex min-h-[44px] items-center gap-2 px-2 text-sm">
              <input type="checkbox" checked={duplicate} onChange={(e) => setDuplicate(e.target.checked)} className="h-5 w-5" />
              Duplicar al arrastrar
            </label>
            <span className="ml-auto text-sm text-[var(--on-surface-variant)]">
              {formatHours(totalMinutes)} planificadas en la semana · {formatEuros(schedule.laborCost.total)} estimados
              {schedule.laborCost.employeesWithoutCost > 0 &&
                ` (${schedule.laborCost.employeesWithoutCost} sin coste hora)`}
              {schedule.lastPublication &&
                ` · publicada por ${schedule.lastPublication.publishedByName} el ${new Date(schedule.lastPublication.publishedAt).toLocaleDateString('es-ES')}`}
            </span>
          </div>

          {span === 'day' ? (
            <ScheduleDayView
              schedule={schedule}
              date={day}
              selectedShiftId={editing && 'shift' in editing ? editing.shift.id : null}
              onSelectShift={(shift) => setEditing({ shift })}
              onAddShift={(employeeId, date) => setEditing({ employeeId, date })}
            />
          ) : (
            <ScheduleGrid
              schedule={schedule}
              selectedShiftId={editing && 'shift' in editing ? editing.shift.id : null}
              onSelectShift={(shift) => setEditing({ shift })}
              onAddShift={(employeeId, date) => setEditing({ employeeId, date })}
              onDropShift={handleDrop}
            />
          )}
          <p className="text-sm text-[var(--on-surface-variant)]">
            {span === 'day'
              ? 'Toca un turno para cambiarlo. Para moverlo a otro día, usa la vista de semana.'
              : 'Arrastra un turno a otro día o a otra persona.'}{' '}
            Borde discontinuo = borrador, todavía no lo ve su persona. Los cambios sobre un turno ya publicado se ven al
            momento.
          </p>

          <ScheduleAlertsCard alerts={schedule.alerts} />

          {editing && <ShiftEditor key={editorKey} schedule={schedule} target={editing} onDone={() => setEditing(null)} />}

          <TemplatesCard schedule={schedule} />
        </>
      )}
    </div>
  );
}
