'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, GraduationCap, Loader2, Plus, Upload } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useNotification } from '@/components/notification-system';
import {
  useCreateSictedTrainingAction,
  useCreateSictedTrainingPlan,
  useMarkSictedTrainingActionDone,
  useRecordSictedAttendance,
  useSictedAttendance,
  useSictedTrainingActions,
  useSictedTrainingCoverage,
  useSictedTrainingPlans,
} from '@/hooks/use-sicted-personas';
import { useUsers } from '@/hooks/use-users';
import { TRAINING_TOPICS, TRAINING_TOPIC_LABELS, type TrainingActionInput, type TrainingTopic } from '@/lib/sicted-personas-types';

const inputCls =
  'min-h-[48px] w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-base';
const MANAGE_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN'];

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));

function ActionForm({ planId, onSaved, onCancel }: { planId: string; onSaved: () => void; onCancel: () => void }) {
  const notify = useNotification();
  const create = useCreateSictedTrainingAction();
  const [form, setForm] = useState<TrainingActionInput>({ topic: 'HIGIENE', title: '', plannedDate: '' });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.plannedDate) {
      notify({ type: 'error', title: 'Faltan campos', message: 'Título y fecha son obligatorios.' });
      return;
    }
    try {
      await create.mutateAsync({ planId, data: form });
      notify({ type: 'success', title: 'Acción formativa creada', message: '' });
      onSaved();
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
      <select
        value={form.topic}
        onChange={(e) => setForm((p) => ({ ...p, topic: e.target.value as TrainingTopic }))}
        className={inputCls}
        style={{ colorScheme: 'light dark' }}
      >
        {TRAINING_TOPICS.map((t) => (
          <option key={t} value={t}>
            {TRAINING_TOPIC_LABELS[t]}
          </option>
        ))}
      </select>
      <input
        value={form.title}
        onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
        placeholder="Título (ej. Curso de alérgenos)"
        className={inputCls}
      />
      <input
        type="date"
        value={form.plannedDate}
        onChange={(e) => setForm((p) => ({ ...p, plannedDate: e.target.value }))}
        className={inputCls}
        style={{ colorScheme: 'light dark' }}
      />
      <input
        value={form.trainer ?? ''}
        onChange={(e) => setForm((p) => ({ ...p, trainer: e.target.value }))}
        placeholder="Formador (opcional)"
        className={inputCls}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={create.isPending}
          className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 font-medium text-primary-foreground disabled:opacity-40"
        >
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Crear acción
        </button>
        <button type="button" onClick={onCancel} className="min-h-[48px] rounded-xl border border-[var(--outline-variant)] px-4 font-medium">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function AttendanceForm({ actionId, planId, onClose }: { actionId: string; planId: string; onClose: () => void }) {
  const notify = useNotification();
  const { data: usersPage } = useUsers(1, 100);
  const users = usersPage?.data ?? [];
  const { data: existing } = useSictedAttendance(actionId);
  const record = useRecordSictedAttendance();
  const [attended, setAttended] = useState<Record<string, boolean>>({});
  const [certificate, setCertificate] = useState<File | null>(null);

  const alreadyRecorded = new Set((existing ?? []).map((a) => a.userId));

  async function handleSubmit() {
    const attendees = Object.entries(attended).map(([userId, att]) => ({ userId, attended: att }));
    if (attendees.length === 0) {
      notify({ type: 'error', title: 'Nadie marcado', message: 'Marca asistencia de al menos una persona.' });
      return;
    }
    try {
      await record.mutateAsync({ actionId, planId, attendees, certificate: certificate ?? undefined });
      notify({ type: 'success', title: 'Asistencia registrada', message: '' });
      onClose();
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
      <p className="text-sm font-medium">Registrar asistencia</p>
      {users
        .filter((u) => !alreadyRecorded.has(u.id))
        .map((u) => (
          <label key={u.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={attended[u.id] ?? false}
              onChange={(e) => setAttended((p) => ({ ...p, [u.id]: e.target.checked }))}
            />
            {u.name}
          </label>
        ))}
      <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[var(--outline-variant)] px-3 text-sm text-[var(--on-surface-variant)]">
        <Upload className="h-4 w-4" />
        {certificate ? certificate.name : 'Certificado (opcional, para todo el lote)'}
        <input type="file" className="hidden" onChange={(e) => setCertificate(e.target.files?.[0] ?? null)} />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={record.isPending}
          onClick={handleSubmit}
          className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-medium text-primary-foreground disabled:opacity-40"
        >
          {record.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Guardar asistencia
        </button>
        <button type="button" onClick={onClose} className="min-h-[44px] rounded-xl border border-[var(--outline-variant)] px-4 text-sm font-medium">
          Cerrar
        </button>
      </div>
    </div>
  );
}

/** Plan anual de formación: cobertura de los 4 temas mínimos, acciones, asistencia. */
export function SictedPersonasTrainingTab() {
  const notify = useNotification();
  const { user } = useAuth();
  const canManage = MANAGE_ROLES.includes(user?.role ?? '');
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const { data: plans } = useSictedTrainingPlans();
  const createPlan = useCreateSictedTrainingPlan();
  const { data: coverage } = useSictedTrainingCoverage(year);
  const plan = useMemo(() => plans?.find((p) => p.year === year), [plans, year]);
  const { data: actions, isLoading: loadingActions } = useSictedTrainingActions(plan?.id ?? null);
  const markDone = useMarkSictedTrainingActionDone();
  const [creatingAction, setCreatingAction] = useState(false);
  const [attendanceForActionId, setAttendanceForActionId] = useState<string | null>(null);

  async function ensurePlan() {
    try {
      await createPlan.mutateAsync(year);
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Inténtalo de nuevo.' });
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-[var(--on-surface-variant)]">Año</span>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className={`${inputCls} mt-1 w-28`}
          />
        </label>
        {!plan && canManage && (
          <button
            type="button"
            disabled={createPlan.isPending}
            onClick={ensurePlan}
            className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Crear plan {year}
          </button>
        )}
      </div>

      {coverage && (
        <section className="mb-6">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--on-surface-variant)]">
            Cobertura de temas mínimos
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {coverage.topics
              .filter((t) => t.required)
              .map((t) => (
                <div
                  key={t.topic}
                  className={`rounded-xl border p-3 text-center text-sm ${
                    t.covered
                      ? 'border-[var(--primary)] bg-[var(--surface-container-lowest)] text-[var(--primary)]'
                      : 'border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] text-[var(--on-surface-variant)]'
                  }`}
                >
                  {TRAINING_TOPIC_LABELS[t.topic]}
                  <br />
                  {t.covered ? 'Cubierto' : 'Pendiente'}
                </div>
              ))}
          </div>
        </section>
      )}

      {plan && (
        <section>
          {canManage && (
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={() => setCreatingAction(true)}
                className="flex min-h-[40px] items-center gap-2 rounded-xl border border-[var(--outline-variant)] px-3 text-sm font-medium"
              >
                <Plus className="h-4 w-4" /> Nueva acción formativa
              </button>
            </div>
          )}
          {creatingAction && (
            <ActionForm planId={plan.id} onSaved={() => setCreatingAction(false)} onCancel={() => setCreatingAction(false)} />
          )}

          {loadingActions ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
            </div>
          ) : !actions || actions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--outline-variant)] p-10 text-center text-[var(--on-surface-variant)]">
              <GraduationCap className="mx-auto mb-2 h-8 w-8 opacity-50" />
              Sin acciones formativas este año.
            </div>
          ) : (
            <div className="space-y-2">
              {actions.map((a) => (
                <div key={a.id} className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{a.title}</p>
                      <p className="text-sm text-[var(--on-surface-variant)]">
                        {TRAINING_TOPIC_LABELS[a.topic]} · {fmtDate(a.plannedDate)} · {a.attendances.length} asistentes
                      </p>
                    </div>
                    {canManage && (
                      <div className="flex gap-2">
                        {!a.done && (
                          <button
                            type="button"
                            disabled={markDone.isPending}
                            onClick={() => markDone.mutate({ id: a.id, planId: plan.id })}
                            className="min-h-[36px] rounded-lg border border-[var(--outline-variant)] px-3 text-xs font-medium"
                          >
                            Marcar hecha
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setAttendanceForActionId(attendanceForActionId === a.id ? null : a.id)}
                          className="min-h-[36px] rounded-lg bg-[var(--primary)] px-3 text-xs font-medium text-primary-foreground"
                        >
                          Asistencia
                        </button>
                      </div>
                    )}
                  </div>
                  {attendanceForActionId === a.id && (
                    <AttendanceForm actionId={a.id} planId={plan.id} onClose={() => setAttendanceForActionId(null)} />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
