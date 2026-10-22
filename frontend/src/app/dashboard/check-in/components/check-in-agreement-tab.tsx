'use client';

import { useState, type FormEvent } from 'react';
import { AlertTriangle, Loader2, Save, Sparkles } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useConfirm } from '@/contexts/confirm.context';
import { useApplyAgreementPreset, useCheckInSettings, useUpdateCheckInSettings } from '@/hooks/use-check-in';
import type { AgreementExtraction, AgreementParams, AgreementPreset, CheckInSettings } from '@/lib/check-in-types';
import { CheckInAgreementExtractCard } from './check-in-agreement-extract-card';
import { cardCls, errorMessage, inputCls, labelCls, primaryBtnCls, secondaryBtnCls } from './check-in-form-styles';

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

/** Valores guardados con lo que propone la IA encima (solo los campos que encontró). */
function initialParams(settings: CheckInSettings, proposal: AgreementExtraction | null): AgreementParams {
  const params: AgreementParams = {
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
  };
  if (!proposal) return params;
  for (const [key, field] of Object.entries(proposal.fields)) {
    if (field) (params as unknown as Record<string, unknown>)[key] = field.value;
  }
  return params;
}

const DAY_TYPE_LABEL: Record<string, string> = { NATURAL: 'días naturales', WORKING: 'días laborables' };

function formatSaved(value: AgreementParams[keyof AgreementParams]): string {
  if (typeof value === 'number') return value.toLocaleString('es-ES');
  return DAY_TYPE_LABEL[value] ?? value;
}

/** Bajo cada campo: de qué artículo sale lo propuesto y si cambia lo guardado. */
function ProposalHint({
  proposal,
  field,
  saved,
}: {
  proposal: AgreementExtraction | null;
  field: keyof AgreementParams;
  saved: AgreementParams[keyof AgreementParams];
}) {
  if (!proposal) return null;
  const found = proposal.fields[field];
  if (!found) {
    return <span className="mt-1 block text-xs text-[var(--on-surface-variant)]">No aparece en el convenio: se mantiene.</span>;
  }
  const changed = found.value !== saved;
  return (
    <span className={`mt-1 block text-xs ${changed ? 'font-medium text-[var(--primary)]' : 'text-[var(--on-surface-variant)]'}`}>
      {changed ? `Cambia (antes ${formatSaved(saved)})` : 'Igual que antes'}
      {found.source ? ` · ${found.source}` : ''}
    </span>
  );
}

function ParamsForm({
  settings,
  proposal,
  onDone,
}: {
  settings: CheckInSettings;
  proposal: AgreementExtraction | null;
  onDone: () => void;
}) {
  const notify = useNotification();
  const update = useUpdateCheckInSettings();
  const saved = initialParams(settings, null);
  const [form, setForm] = useState<AgreementParams>(() => initialParams(settings, proposal));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await update.mutateAsync(form);
      notify({ type: 'success', title: 'Parámetros guardados', message: '' });
      onDone();
    } catch (err) {
      notify({ type: 'error', title: 'Error', message: errorMessage(err) });
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${cardCls} space-y-4`}>
      <h3 className="font-semibold">Parámetros del convenio</h3>
      {proposal && (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--primary)] p-3 text-sm">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" />
          <p>
            Propuesta leída{proposal.agreementName ? ` de «${proposal.agreementName}»` : ' del convenio'}. Comprueba
            cada valor con su artículo antes de guardar: la IA puede equivocarse.
          </p>
        </div>
      )}
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
            <ProposalHint proposal={proposal} field={key} saved={saved[key]} />
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
          <ProposalHint proposal={proposal} field="vacationDayType" saved={saved.vacationDayType} />
        </label>
        <label className="block">
          <span className={labelCls}>Inicio de la franja nocturna</span>
          <input
            type="time"
            value={form.nightStart}
            onChange={(e) => setForm((prev) => ({ ...prev, nightStart: e.target.value }))}
            className={inputCls}
          />
          <ProposalHint proposal={proposal} field="nightStart" saved={saved.nightStart} />
        </label>
        <label className="block">
          <span className={labelCls}>Fin de la franja nocturna</span>
          <input
            type="time"
            value={form.nightEnd}
            onChange={(e) => setForm((prev) => ({ ...prev, nightEnd: e.target.value }))}
            className={inputCls}
          />
          <ProposalHint proposal={proposal} field="nightEnd" saved={saved.nightEnd} />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={update.isPending} className={primaryBtnCls}>
          {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar parámetros
        </button>
        {proposal && (
          <button type="button" onClick={onDone} disabled={update.isPending} className={secondaryBtnCls}>
            Descartar propuesta
          </button>
        )}
      </div>
    </form>
  );
}

/**
 * Convenio: elegir plantilla (copia sus valores), leer el PDF del convenio con
 * IA para proponer los parámetros, y ajustarlos.
 */
export function CheckInAgreementTab() {
  const notify = useNotification();
  const confirm = useConfirm();
  const { data, isLoading } = useCheckInSettings();
  const applyPreset = useApplyAgreementPreset();
  const [proposal, setProposal] = useState<AgreementExtraction | null>(null);
  // Cada propuesta nueva remonta el formulario con sus valores.
  const [proposalVersion, setProposalVersion] = useState(0);

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
      // La plantilla sustituye los parámetros: una propuesta pendiente ya no aplica.
      setProposal(null);
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
      <CheckInAgreementExtractCard
        onProposal={(extraction) => {
          setProposal(extraction);
          setProposalVersion((v) => v + 1);
        }}
      />
      {/* key: al aplicar otra plantilla, guardar o leer otro convenio, el formulario se remonta con los valores nuevos. */}
      <ParamsForm
        key={`${settings.updatedAt}-${proposalVersion}`}
        settings={settings}
        proposal={proposal}
        onDone={() => {
          setProposal(null);
          setProposalVersion((v) => v + 1);
        }}
      />
    </div>
  );
}
