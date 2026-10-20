'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useConfirm } from '@/contexts/confirm.context';
import { useNotification } from '@/components/notification-system';
import { useSuperviseSictedRun } from '@/hooks/use-sicted';
import { formatPeriodKey, type ChecklistRunSummary } from '@/lib/sicted-types';
import { SictedPerformerPicker, type SictedPerformer } from './sicted-performer-picker';

const SUPERVISOR_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN'];

interface SictedPendingValidationProps {
  runs: ChecklistRunSummary[];
}

/**
 * Hojas terminadas a la espera de la firma del encargado. Quien puede validar
 * ve una casilla por hoja (más «Todas») para validar varias de una vez con la
 * misma firma; el resto solo tiene el acceso al detalle. Validar sella la hoja:
 * se pide confirmación antes de sellar en bloque.
 */
export function SictedPendingValidation({ runs }: SictedPendingValidationProps) {
  const router = useRouter();
  const { user } = useAuth();
  const confirm = useConfirm();
  const notify = useNotification();
  const supervise = useSuperviseSictedRun();

  const [selected, setSelected] = useState<string[]>([]);
  const [pickedPerformer, setPickedPerformer] = useState<SictedPerformer | null>(null);

  const canSupervise = SUPERVISOR_ROLES.includes(user?.role ?? '');
  // Selección viva: descarta ids que ya no están pendientes (validadas mientras tanto).
  const selectedIds = selected.filter((id) => runs.some((r) => r.id === id));
  const allSelected = runs.length > 0 && selectedIds.length === runs.length;

  // Misma regla que al validar desde el detalle: cuenta personal firma ella
  // misma; cuenta compartida elige el nombre real.
  const sharedAccount = !!user?.isSharedAccount;
  const performer: SictedPerformer | null = sharedAccount
    ? pickedPerformer
    : user
      ? { userId: user.id, name: user.name }
      : null;

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  async function handleValidateSelected() {
    if (!performer) {
      notify({ type: 'error', title: 'Falta el "quién"', message: 'Elige tu nombre para validar.' });
      return;
    }
    const targets = runs.filter((r) => selectedIds.includes(r.id));
    if (targets.length === 0) return;
    const ok = await confirm({
      title: targets.length === 1 ? 'Validar 1 hoja' : `Validar ${targets.length} hojas`,
      description: 'Al validar quedan selladas y no podrán modificarse. ¿Confirmas que las revisaste todas?',
      confirmText: 'Validar',
      variant: 'info',
    });
    if (!ok) return;

    const failed: string[] = [];
    for (const run of targets) {
      try {
        await supervise.mutateAsync({
          runId: run.id,
          supervisorName: performer.name,
          supervisorUserId: performer.userId,
        });
      } catch {
        failed.push(run.id);
      }
    }
    // Las que fallaron quedan marcadas para reintentar o revisarlas una a una.
    setSelected(failed);
    if (failed.length === 0) {
      notify({
        type: 'success',
        title: targets.length === 1 ? 'Hoja validada' : `${targets.length} hojas validadas`,
        message: '',
      });
    } else {
      const names = targets
        .filter((r) => failed.includes(r.id))
        .map((r) => r.template.name)
        .join(', ');
      notify({
        type: 'error',
        title: failed.length === 1 ? '1 hoja sin validar' : `${failed.length} hojas sin validar`,
        message: `${names}. Revísala desde su detalle.`,
      });
    }
  }

  return (
    <section className="mb-6">
      <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold uppercase tracking-wide text-[var(--on-surface-variant)]">
        <ShieldAlert className="h-4 w-4" /> Pendientes de validar ({runs.length})
      </h3>

      {canSupervise && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <label className="flex min-h-[44px] items-center gap-2 rounded-lg bg-[var(--surface-container)] px-3 py-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = selectedIds.length > 0 && !allSelected;
              }}
              onChange={() => setSelected(allSelected ? [] : runs.map((r) => r.id))}
              className="h-5 w-5"
            />
            Todas
          </label>
          <div className="min-w-[220px] flex-1">
            <SictedPerformerPicker value={performer} onChange={setPickedPerformer} fixed={!sharedAccount} />
          </div>
          <button
            type="button"
            disabled={selectedIds.length === 0 || supervise.isPending}
            onClick={handleValidateSelected}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-medium text-primary-foreground disabled:opacity-40"
          >
            {supervise.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Validar{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
          </button>
        </div>
      )}

      <ul className="space-y-1 text-sm">
        {runs.map((r) => (
          <li key={r.id} className="flex items-center gap-2">
            {canSupervise && (
              <label
                className="flex min-h-[44px] shrink-0 items-center rounded-lg bg-[var(--surface-container)] px-3"
                aria-label={`Seleccionar ${r.template.name} — ${formatPeriodKey(r.periodKey)}`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(r.id)}
                  onChange={() => toggle(r.id)}
                  className="h-5 w-5"
                />
              </label>
            )}
            <button
              type="button"
              onClick={() => router.push(`/dashboard/sicted/registros/${r.id}`)}
              className="flex min-h-[44px] flex-1 items-center justify-between gap-2 rounded-lg bg-[var(--surface-container)] px-3 py-2 text-left hover:bg-[var(--surface-container-high)]"
            >
              <span>
                {r.template.name} — {r.template.area}
                <span className="text-[var(--on-surface-variant)]"> · {formatPeriodKey(r.periodKey)}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[var(--on-surface-variant)]" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
