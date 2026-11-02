'use client';

import { useState } from 'react';
import { MonitorSmartphone } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useNotification } from '@/components/notification-system';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  DASHBOARD_TEMPLATES,
  DASHBOARD_WIDGETS,
  type DashboardLayout,
  type SharedDeviceLayout,
} from '@/features/dashboard-layout/dashboard-widgets';
import {
  useResetDeviceLayout,
  useSaveDeviceLayout,
  useSharedDeviceLayouts,
} from '@/features/dashboard-layout/use-dashboard-layout';

const MANAGER_ROLES = ['OWNER', 'ADMIN'];
const TITLE_MAX_LENGTH = 40;

/**
 * Pantalla de inicio de cada dispositivo compartido (Cocina, Sala…): título y
 * cards del dashboard. Solo oculta cards; lo que el dispositivo puede ver lo
 * siguen decidiendo sus permisos.
 */
export function DashboardDevicesConfigSection() {
  const { user } = useAuth();
  if (!MANAGER_ROLES.includes(user?.role ?? '')) return null;
  return <DashboardDevicesList />;
}

function DashboardDevicesList() {
  const { data: devices, isLoading } = useSharedDeviceLayouts(true);
  const [editing, setEditing] = useState<SharedDeviceLayout | null>(null);

  return (
    <section className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--on-surface)]">
        <MonitorSmartphone className="h-5 w-5 text-[var(--primary)]" />
        Pantallas de dispositivos
      </h2>
      <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
        Elige qué muestra el inicio de cada dispositivo compartido y con qué título. Las cuentas
        personales ven siempre el inicio completo.
      </p>

      {isLoading ? (
        <div className="py-6 text-sm text-[var(--on-surface-variant)]">Cargando…</div>
      ) : !devices || devices.length === 0 ? (
        <div className="py-6 text-sm text-[var(--on-surface-variant)]">
          No hay dispositivos compartidos. Se crean en Equipo.
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--outline-variant)] rounded-xl border border-[var(--outline-variant)]">
          {devices.map((device) => (
            <li key={device.userId} className="flex min-h-[44px] items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-[var(--on-surface)]">{device.name}</span>
                <span className="block truncate text-xs text-[var(--on-surface-variant)]">
                  {device.layout
                    ? `«${device.layout.title}» · ${device.layout.widgets.length} cards`
                    : 'Inicio completo (sin configurar)'}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setEditing(device)}
                className="shrink-0 rounded-lg border border-[var(--outline-variant)] px-3 py-1.5 text-sm text-[var(--on-surface)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
              >
                Configurar
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-lg">
          {editing && (
            // key: cada dispositivo abre el editor con su propio estado.
            <DeviceLayoutEditor key={editing.userId} device={editing} onDone={() => setEditing(null)} />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function DeviceLayoutEditor({ device, onDone }: { device: SharedDeviceLayout; onDone: () => void }) {
  const notify = useNotification();
  const save = useSaveDeviceLayout();
  const reset = useResetDeviceLayout();
  // Sin configurar: se parte de lo que ve hoy (todo) con su nombre de título.
  const [draft, setDraft] = useState<DashboardLayout>(
    device.layout ?? { title: device.name, widgets: DASHBOARD_WIDGETS.map((w) => w.id) },
  );
  const busy = save.isPending || reset.isPending;

  const toggle = (id: string) =>
    setDraft((d) => ({
      ...d,
      widgets: d.widgets.includes(id) ? d.widgets.filter((w) => w !== id) : [...d.widgets, id],
    }));

  async function run(action: () => Promise<unknown>, done: string) {
    try {
      await action();
      notify({ type: 'success', title: done, message: device.name });
      onDone();
    } catch (e) {
      notify({
        type: 'error',
        title: 'No se pudo guardar',
        message: e instanceof Error ? e.message : 'Inténtalo de nuevo.',
      });
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Pantalla de «{device.name}»</DialogTitle>
        <DialogDescription>
          Si el dispositivo no tiene permiso para una sección, su card no aparece aunque esté
          marcada.
        </DialogDescription>
      </DialogHeader>

      <label className="block text-sm">
        <span className="text-[var(--on-surface-variant)]">Título del inicio</span>
        <input
          value={draft.title}
          maxLength={TITLE_MAX_LENGTH}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          className="mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-transparent px-3 py-2 text-base text-[var(--on-surface)]"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-[var(--on-surface-variant)]">Plantilla:</span>
        {DASHBOARD_TEMPLATES.map((t) => (
          <button
            key={t.name}
            type="button"
            onClick={() => setDraft({ ...t.layout, widgets: [...t.layout.widgets] })}
            className="rounded-full border border-[var(--outline-variant)] px-3 py-1 hover:border-[var(--primary)] hover:text-[var(--primary)]"
          >
            {t.name}
          </button>
        ))}
      </div>

      <ul className="divide-y divide-[var(--outline-variant)] rounded-xl border border-[var(--outline-variant)]">
        {DASHBOARD_WIDGETS.map((w) => (
          <li key={w.id}>
            <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 px-3 py-2 text-[var(--on-surface)]">
              {w.label}
              <Switch checked={draft.widgets.includes(w.id)} onCheckedChange={() => toggle(w.id)} />
            </label>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          disabled={busy || !device.layout}
          onClick={() => run(() => reset.mutateAsync(device.userId), 'Inicio completo restablecido')}
          className="text-sm text-[var(--on-surface-variant)] hover:text-[var(--primary)] disabled:opacity-40"
        >
          Restablecer (ver todo)
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onDone}
            className="rounded-lg border border-[var(--outline-variant)] px-4 py-2 text-sm text-[var(--on-surface)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy || !draft.title.trim()}
            onClick={() =>
              run(
                () => save.mutateAsync({ userId: device.userId, layout: { ...draft, title: draft.title.trim() } }),
                'Pantalla guardada',
              )
            }
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
          >
            Guardar
          </button>
        </div>
      </div>
    </>
  );
}
