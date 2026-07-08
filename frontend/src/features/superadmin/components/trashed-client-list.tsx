'use client';

import { useConfirm } from '@/contexts/confirm.context';
import { useNotification } from '@/components/notification-system';
import type { TrashedTenant } from '../api/superadmin-api';

interface TrashedClientListProps {
  clients: TrashedTenant[];
  onRestore: (id: string) => Promise<void>;
  onPurge: (id: string) => Promise<void>;
}

export function TrashedClientList({
  clients,
  onRestore,
  onPurge,
}: TrashedClientListProps) {
  const confirm = useConfirm();
  const notify = useNotification();

  if (clients.length === 0) {
    return (
      <div className="p-6 text-on-surface-variant font-label-md text-label-md text-center">
        La papelera está vacía.
      </div>
    );
  }

  const handleRestore = async (t: TrashedTenant) => {
    const ok = await confirm({
      title: `Reactivar a "${t.name}"`,
      description: 'El cliente volverá a estar activo y sus usuarios podrán iniciar sesión de nuevo.',
      confirmText: 'Reactivar',
      variant: 'info',
    });
    if (!ok) return;
    try {
      await onRestore(t.id);
    } catch (e) {
      notify({ type: 'error', title: 'No se pudo reactivar', message: e instanceof Error ? e.message : 'Error' });
    }
  };

  const handlePurge = async (t: TrashedTenant) => {
    // Doble confirmación: el purge borra el cliente y TODOS sus datos.
    const ok = await confirm({
      title: `Borrar DEFINITIVAMENTE a "${t.name}"`,
      description:
        'Acción irreversible: se borrarán para siempre el cliente y TODOS sus datos (usuarios, artículos, recetas, albaranes, etc.). Considera exportar una copia de seguridad antes.',
      confirmText: 'Borrar definitivamente',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await onPurge(t.id);
    } catch (e) {
      notify({ type: 'error', title: 'No se pudo borrar', message: e instanceof Error ? e.message : 'Error' });
    }
  };

  return (
    <ul className="divide-y divide-border">
      {clients.map((t) => (
        <li key={t.id} className="px-stack-lg py-stack-md">
          <div className="flex items-start justify-between gap-stack-md">
            <div className="min-w-0">
              <p className="font-label-md text-label-md text-on-surface truncate">{t.name}</p>
              <p className="font-label-sm text-label-sm text-on-surface-variant mt-0.5 truncate">
                {t.slug}
                {t.contactEmail ? ` · ${t.contactEmail}` : ''}
              </p>
              <p className="font-label-sm text-label-sm text-on-surface-variant/70 mt-0.5">
                Dado de baja: {new Date(t.deletedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex gap-stack-sm mt-stack-sm">
            <button
              onClick={() => handleRestore(t)}
              className="flex-1 px-stack-md py-stack-sm rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm hover:opacity-90 cursor-pointer"
            >
              Reactivar
            </button>
            <button
              onClick={() => handlePurge(t)}
              className="flex-1 px-stack-md py-stack-sm rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm hover:opacity-90 cursor-pointer"
            >
              Borrar definitivo
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
