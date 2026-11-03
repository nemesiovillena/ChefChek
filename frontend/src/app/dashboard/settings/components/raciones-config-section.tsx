'use client';

import { useState } from 'react';
import { Utensils } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useNotification } from '@/components/notification-system';
import { useModules } from '@/features/modules/hooks/use-modules';
import {
  usePortionSettings,
  useUpdatePortionSettings,
  type PortionLoadSource,
  type PortionSettings,
} from '@/hooks/use-raciones';

const MANAGER_ROLES = ['OWNER', 'ADMIN'];

const OPTIONS: { value: PortionLoadSource; label: string; help: string; needsLive: boolean }[] = [
  {
    value: 'CHEFCHEK',
    label: 'Solo en ChefChek',
    help: 'Se carga con etiquetas, recuentos y ajustes en ChefChek. Lo que se cargue en el TPV no cuenta aquí.',
    needsLive: false,
  },
  {
    value: 'TPV',
    label: 'En el TPV (ChefChek solo muestra)',
    help: 'Se carga en el Contador de platos de Cuiner. ChefChek copia lo que marca: las etiquetas no suman raciones y no hay recuentos ni ajustes aquí.',
    needsLive: true,
  },
  {
    value: 'BOTH',
    label: 'En los dos',
    help: 'Lo cargado en ChefChek pasa a Cuiner y lo cargado en Cuiner pasa a ChefChek. Avisa si no coinciden o si parece cargado dos veces.',
    needsLive: true,
  },
];

/**
 * Configuración → Contador de platos. Cada restaurante elige dónde se cargan
 * las raciones; sin TPV enlazado en vivo solo cabe «Solo en ChefChek».
 */
export function RacionesConfigSection() {
  const { user } = useAuth();
  const { isEnabled } = useModules();
  const isManager = MANAGER_ROLES.includes(user?.role ?? '');
  const enabled = isEnabled('raciones') && isManager;
  const { data, isLoading } = usePortionSettings(enabled);
  if (!enabled) return null;

  return (
    <section className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--on-surface)]">
        <Utensils className="h-5 w-5 text-[var(--primary)]" />
        Contador de platos
      </h2>
      <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
        Dónde se cargan las raciones disponibles de cada plato. Los pedidos del TPV descuentan siempre que esté
        enlazado. Los platos que el TPV lleva por piezas con peso (chuletón, parpatana) se cargan siempre en el TPV.
      </p>
      {isLoading || !data ? (
        <div className="py-6 text-sm text-[var(--on-surface-variant)]">Cargando…</div>
      ) : (
        <RacionesSettingsForm key={`${data.loadSource}-${data.doubleLoadHours}`} saved={data} />
      )}
    </section>
  );
}

function RacionesSettingsForm({ saved }: { saved: PortionSettings }) {
  const notify = useNotification();
  const update = useUpdatePortionSettings();
  const [source, setSource] = useState<PortionLoadSource>(saved.loadSource);
  const [hours, setHours] = useState(String(saved.doubleLoadHours));
  const hoursNum = Number(hours);
  const hoursValid = Number.isInteger(hoursNum) && hoursNum >= 1 && hoursNum <= 72;
  const dirty = source !== saved.loadSource || (source === 'BOTH' && hoursNum !== saved.doubleLoadHours);

  const save = () =>
    update.mutate(
      { loadSource: source, ...(source === 'BOTH' && hoursValid ? { doubleLoadHours: hoursNum } : {}) },
      {
        onSuccess: () => notify({ type: 'success', title: 'Guardado', message: 'Contador de platos actualizado.' }),
        onError: (err) => notify({ type: 'error', title: 'No se pudo guardar', message: (err as Error).message }),
      },
    );

  return (
    <div className="mt-4 space-y-4">
      {!saved.live && (
        <p className="rounded-lg bg-[var(--surface-container)] px-3 py-2 text-sm text-[var(--on-surface-variant)]">
          No hay un TPV enlazado en vivo: las raciones solo se pueden cargar en ChefChek.
        </p>
      )}
      <ul className="divide-y divide-[var(--outline-variant)] rounded-xl border border-[var(--outline-variant)]">
        {OPTIONS.map((o) => {
          const disabled = o.needsLive && !saved.live;
          return (
            <li key={o.value}>
              <label
                className={`flex min-h-[44px] items-start gap-3 px-3 py-3 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
              >
                <input
                  type="radio"
                  name="raciones-load-source"
                  className="mt-1 h-4 w-4 accent-[var(--primary)] [color-scheme:light_dark]"
                  checked={source === o.value}
                  disabled={disabled}
                  onChange={() => setSource(o.value)}
                />
                <span>
                  <span className="block font-medium text-[var(--on-surface)]">{o.label}</span>
                  <span className="block text-sm text-[var(--on-surface-variant)]">{o.help}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {source === 'BOTH' && (
        <label className="block text-sm">
          <span className="text-[var(--on-surface)]">Avisar de posible carga doble si ChefChek y el TPV cargan el mismo plato en menos de</span>
          <span className="mt-1 flex items-center gap-2">
            <input
              inputMode="numeric"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="h-10 w-20 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-base"
            />
            <span className="text-[var(--on-surface-variant)]">horas</span>
          </span>
          {!hoursValid && <span className="mt-1 block text-xs text-error">Entre 1 y 72 horas.</span>}
        </label>
      )}
      <button
        type="button"
        onClick={save}
        disabled={!dirty || !hoursValid || update.isPending}
        className="min-h-[44px] rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        Guardar
      </button>
    </div>
  );
}
