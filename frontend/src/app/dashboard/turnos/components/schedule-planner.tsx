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
import { ScheduleGrid } from './schedule-grid';
import { ShiftEditor, type EditorTarget } from './shift-editor';
import { addDaysIso, formatHours, formatWeekRange, mondayOf } from './week-utils';

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
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [chosenCenter, setChosenCenter] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditorTarget | null>(null);
  const [duplicate, setDuplicate] = useState(false);

  const activeCenters = (centers ?? []).filter((c) => c.isActive);
  // Sin elegir, el centro principal.
  const locationId = chosenCenter ?? activeCenters.find((c) => c.isDefault)?.id ?? activeCenters[0]?.id ?? null;
  const { data: schedule, isLoading } = useSchedule(locationId, weekStart);
  const update = useUpdateShift(locationId, weekStart);
  const create = useCreateShift();
  const copyWeek = useCopyWeek();
  const publish = usePublishWeek();

  function goToWeek(next: string) {
    setEditing(null);
    setWeekStart(next);
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
      description: 'Se añaden a esta semana los turnos de la anterior, como borradores. Los que no encajen (ausencias, turnos que se pisan) se saltan.',
    });
    if (!ok) return;
    try {
      const result = await copyWeek.mutateAsync({
        locationId,
        fromWeekStart: addDaysIso(weekStart, -7),
        toWeekStart: weekStart,
      });
      notify({
        type: result.copied > 0 ? 'success' : 'warning',
        title: `${result.copied} turno${result.copied === 1 ? '' : 's'} copiado${result.copied === 1 ? '' : 's'}`,
        message: result.skipped > 0 ? `${result.skipped} no se copiaron porque no encajan en esta semana.` : '',
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
          <button type="button" onClick={() => goToWeek(addDaysIso(weekStart, -7))} className={navBtn} aria-label="Semana anterior">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="min-w-[170px] text-center font-medium">{formatWeekRange(weekStart)}</span>
          <button type="button" onClick={() => goToWeek(addDaysIso(weekStart, 7))} className={navBtn} aria-label="Semana siguiente">
            <ChevronRight className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => goToWeek(mondayOf(new Date()))} className="min-h-[44px] px-2 text-sm underline">
            Hoy
          </button>
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

      {isLoading || !schedule ? (
        <p className="text-[var(--on-surface-variant)]">Cargando…</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={handlePublish} disabled={schedule.draftCount === 0 || publish.isPending} className={primaryBtnCls}>
              {publish.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {schedule.draftCount > 0 ? `Publicar (${schedule.draftCount} sin publicar)` : 'Todo publicado'}
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
              {formatHours(totalMinutes)} planificadas
              {schedule.lastPublication &&
                ` · publicada por ${schedule.lastPublication.publishedByName} el ${new Date(schedule.lastPublication.publishedAt).toLocaleDateString('es-ES')}`}
            </span>
          </div>

          <ScheduleGrid
            schedule={schedule}
            selectedShiftId={editing && 'shift' in editing ? editing.shift.id : null}
            onSelectShift={(shift) => setEditing({ shift })}
            onAddShift={(employeeId, date) => setEditing({ employeeId, date })}
            onDropShift={handleDrop}
          />
          <p className="text-sm text-[var(--on-surface-variant)]">
            Arrastra un turno a otro día o a otra persona. Borde discontinuo = borrador, todavía no lo ve su persona. Los
            cambios sobre un turno ya publicado se ven al momento.
          </p>

          {editing && <ShiftEditor key={editorKey} schedule={schedule} target={editing} onDone={() => setEditing(null)} />}

          <TemplatesCard schedule={schedule} />
        </>
      )}
    </div>
  );
}
