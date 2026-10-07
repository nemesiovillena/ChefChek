'use client';

import { useState } from 'react';
import { Clock } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useNotification } from '@/components/notification-system';
import { useModules } from '@/features/modules/hooks/use-modules';
import { useCheckInSettings, useUpdateCheckInSettings } from '@/hooks/use-check-in';
import type { CheckInSettings } from '@/lib/check-in-types';
import { canManageCheckIn } from '@/app/dashboard/check-in/components/check-in-form-styles';

type ToggleKey = 'allowBreaks' | 'showRecentPunches' | 'showMonthPicker' | 'showOwnAdjustments' | 'showAddMissingDay';

const TOGGLES: { key: ToggleKey; label: string; help: string }[] = [
  {
    key: 'allowBreaks',
    label: 'Permitir pausas',
    help: 'Sin marcar, desaparece «Empezar pausa» para todo el mundo: estando dentro solo se puede fichar la salida.',
  },
  {
    key: 'showRecentPunches',
    label: 'Mostrar «Últimos fichajes»',
    help: 'La lista que aparece bajo los botones de fichar.',
  },
  {
    key: 'showMonthPicker',
    label: 'Mostrar el selector de mes',
    help: 'Sin marcar, en Registro de jornada el empleado ve solo el mes en curso.',
  },
  {
    key: 'showOwnAdjustments',
    label: 'Mostrar «Mis solicitudes de corrección»',
    help: 'El estado de las correcciones que ha pedido el empleado.',
  },
  {
    key: 'showAddMissingDay',
    label: 'Mostrar «¿Falta un día entero?»',
    help: 'Permite al empleado pedir un fichaje en un día que no tiene ninguno.',
  },
];

const pick = (settings: CheckInSettings): Record<ToggleKey, boolean> => ({
  allowBreaks: settings.allowBreaks,
  showRecentPunches: settings.showRecentPunches,
  showMonthPicker: settings.showMonthPicker,
  showOwnAdjustments: settings.showOwnAdjustments,
  showAddMissingDay: settings.showAddMissingDay,
});

/**
 * Configuración → Check-in: qué ve y qué puede hacer el empleado al fichar.
 * Los bloques ocultos lo están solo para empleados; quien gestiona el módulo
 * los ve siempre. Las pausas son una regla del local y aplican a todos.
 */
export function CheckInConfigSection() {
  const { user } = useAuth();
  const { isEnabled } = useModules();
  // Los ajustes solo los sirve la API a quien gestiona el módulo.
  if (!isEnabled('check-in') || !canManageCheckIn(user)) return null;
  return <CheckInConfigPanel />;
}

function CheckInConfigPanel() {
  const { data, isLoading } = useCheckInSettings();
  return (
    <section className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--on-surface)]">
        <Clock className="h-5 w-5 text-[var(--primary)]" />
        Check-in
      </h2>
      <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
        Elige qué ven los empleados en el módulo de fichaje. Quien gestiona Check-in lo sigue viendo todo. El Registro de
        jornada no se puede ocultar: el trabajador tiene derecho a consultarlo.
      </p>
      {isLoading || !data ? (
        <div className="py-6 text-sm text-[var(--on-surface-variant)]">Cargando…</div>
      ) : (
        <CheckInToggles key={data.settings.updatedAt} saved={pick(data.settings)} />
      )}
    </section>
  );
}

function CheckInToggles({ saved }: { saved: Record<ToggleKey, boolean> }) {
  const notify = useNotification();
  const update = useUpdateCheckInSettings();
  const [draft, setDraft] = useState(saved);
  const dirty = TOGGLES.some(({ key }) => draft[key] !== saved[key]);

  async function handleSave() {
    try {
      await update.mutateAsync(draft);
      notify({ type: 'success', title: 'Guardado', message: 'Ajustes de Check-in actualizados.' });
    } catch (e) {
      notify({ type: 'error', title: 'Error', message: e instanceof Error ? e.message : 'No se pudieron guardar los ajustes.' });
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <ul className="divide-y divide-[var(--outline-variant)] rounded-xl border border-[var(--outline-variant)]">
        {TOGGLES.map(({ key, label, help }) => (
          <li key={key}>
            <label className="flex min-h-[44px] cursor-pointer items-start gap-3 px-3 py-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 cursor-pointer accent-[var(--primary)] [color-scheme:light_dark]"
                checked={draft[key]}
                onChange={() => setDraft((prev) => ({ ...prev, [key]: !prev[key] }))}
              />
              <span>
                <span className="block font-medium text-[var(--on-surface)]">{label}</span>
                <span className="block text-sm text-[var(--on-surface-variant)]">{help}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={!dirty || update.isPending}
        onClick={handleSave}
        className="inline-flex min-h-[44px] items-center rounded-full bg-[var(--primary)] px-5 text-sm font-medium text-primary-foreground disabled:opacity-40"
      >
        {update.isPending ? 'Guardando…' : 'Guardar'}
      </button>
    </div>
  );
}
