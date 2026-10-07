'use client';

import { useState, type FormEvent } from 'react';
import { AlertTriangle, Loader2, Save } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useConfirm } from '@/contexts/confirm.context';
import { useApplyAgreementPreset, useCheckInSettings, useUpdateCheckInSettings } from '@/hooks/use-check-in';
import type { AgreementParams, AgreementPreset, CheckInSettings } from '@/lib/check-in-types';
import { cardCls, errorMessage, inputCls, labelCls, primaryBtnCls } from './check-in-form-styles';

type NumericKey = Exclude<keyof AgreementParams, 'nightStart' | 'nightEnd' | 'vacationDayType'>;

const NUMERIC_FIELDS: { key: NumericKey; label: string; step: number }[] = [
  { key: 'annualHours', label: 'Jornada anual (horas)', step: 1 },
  { key: 'weeklyHours', label: 'Jornada semanal (horas)', step: 0.5 },
  { key: 'maxDailyHours', label: 'Máximo de horas ordinarias al día', step: 0.5 },
  { key: 'minRestBetweenShiftsHours', label: 'Descanso mínimo entre jornadas (horas)', step: 0.5 },
  { key: 'weeklyRestDays', label: 'Descanso semanal (días)', step: 0.5 },
  { key: 'vacationDays', label: 'Días de vacaciones al año', step: 1 },
  { key: 'overtimeYearlyCap', label: 'Tope de horas extra al año', step: 1 },
];

function ParamsForm({ settings }: { settings: CheckInSettings }) {
  const notify = useNotification();
  const update = useUpdateCheckInSettings();
  const [form, setForm] = useState<AgreementParams>({
    annualHours: settings.annualHours,
    weeklyHours: settings.weeklyHours,
    maxDailyHours: settings.maxDailyHours,
    minRestBetweenShiftsHours: settings.minRestBetweenShiftsHours,
    weeklyRestDays: settings.weeklyRestDays,
    nightStart: settings.nightStart,
    nightEnd: settings.nightEnd,
    vacationDays: settings.vacationDays,
    vacationDayType: settings.vacationDayType,
    overtimeYearlyCap: settings.overtimeYearlyCap,
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await update.mutateAsync(form);
      notify({ type: 'success', title: 'Parámetros guardados', message: '' });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${cardCls} space-y-4`}>
      <h3 className="font-semibold">Parámetros del convenio</h3>
      <div className="grid gap-3 md:grid-cols-2">
        {NUMERIC_FIELDS.map(({ key, label, step }) => (
          <label key={key} className="block">
            <span className={labelCls}>{label}</span>
            <input
              type="number"
              min={0}
              step={step}
              value={form[key]}
              onChange={(e) => setForm((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
              className={inputCls}
            />
          </label>
        ))}
        <label className="block">
          <span className={labelCls}>Cómputo de vacaciones</span>
          <select
            value={form.vacationDayType}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, vacationDayType: e.target.value as AgreementParams['vacationDayType'] }))
            }
            className={inputCls}
          >
            <option value="NATURAL">Días naturales</option>
            <option value="WORKING">Días laborables</option>
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Inicio de la franja nocturna</span>
          <input
            type="time"
            value={form.nightStart}
            onChange={(e) => setForm((prev) => ({ ...prev, nightStart: e.target.value }))}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className={labelCls}>Fin de la franja nocturna</span>
          <input
            type="time"
            value={form.nightEnd}
            onChange={(e) => setForm((prev) => ({ ...prev, nightEnd: e.target.value }))}
            className={inputCls}
          />
        </label>
      </div>
      <button type="submit" disabled={update.isPending} className={primaryBtnCls}>
        {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Guardar parámetros
      </button>
    </form>
  );
}

/** Convenio: elegir plantilla (copia sus valores) y ajustar los parámetros. */
export function CheckInAgreementTab() {
  const notify = useNotification();
  const confirm = useConfirm();
  const { data, isLoading } = useCheckInSettings();
  const applyPreset = useApplyAgreementPreset();

  if (isLoading || !data) return <p className="text-[var(--on-surface-variant)]">Cargando…</p>;
  const { settings, presets } = data;
  const active: AgreementPreset | undefined = presets.find((p) => p.key === settings.agreementKey);

  async function handleSelect(key: string) {
    if (key === settings.agreementKey) return;
    const preset = presets.find((p) => p.key === key);
    const ok = await confirm({
      title: `Aplicar convenio: ${preset?.name ?? key}`,
      description: 'Se sustituirán los parámetros actuales por los de la plantilla. Podrás editarlos después.',
    });
    if (!ok) return;
    try {
      await applyPreset.mutateAsync(key);
      notify({ type: 'success', title: 'Convenio aplicado', message: 'Revisa los parámetros.' });
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }

  return (
    <div className="space-y-4">
      <div className={cardCls}>
        <label className="block">
          <span className={labelCls}>Convenio aplicable</span>
          <select
            value={settings.agreementKey}
            onChange={(e) => handleSelect(e.target.value)}
            disabled={applyPreset.isPending}
            className={inputCls}
          >
            {presets.map((p) => (
              <option key={p.key} value={p.key}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {active && (
          <p className="mt-3 flex items-start gap-2 text-sm text-[var(--on-surface-variant)]">
            {active.needsReview && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--error)]" />}
            {active.note}
          </p>
        )}
      </div>
      {/* key: al aplicar otra plantilla o guardar, el formulario se remonta con los valores nuevos. */}
      <ParamsForm key={settings.updatedAt} settings={settings} />
    </div>
  );
}
