'use client';

import { Loader2, Download, RotateCcw, Trash2, ShieldCheck } from 'lucide-react';
import { useConfirm } from '@/contexts/confirm.context';
import { useNotification } from '@/components/notification-system';
import { useDeleteBackup, useRestoreExistingById, downloadBackup, type BackupFileMeta } from '@/hooks/use-backups';
import { formatBytes } from '@/lib/utils';

interface Props {
  baseUrl: string;
  backups: BackupFileMeta[];
  loading: boolean;
  error: Error | null;
  /** Notifica al padre que empezó un job de restore (para mostrar su progreso). */
  onRestoreStarted: (jobId: string) => void;
}

/** "14:32 · 7 jul 2026". */
function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Tarjeta/listado de copias EXPORT con acciones por fila. */
export function BackupList({ baseUrl, backups, loading, error, onRestoreStarted }: Props) {
  const confirm = useConfirm();
  const addNotification = useNotification();
  const deleteMut = useDeleteBackup(baseUrl);
  const restoreExisting = useRestoreExistingById(baseUrl);

  const handleDownload = async (b: BackupFileMeta) => {
    try {
      await downloadBackup(baseUrl, b.id, b.filename ?? `backup-${b.id}.json`);
    } catch (e) {
      addNotification({ type: 'error', title: 'Descarga fallida', message: (e as Error).message });
    }
  };

  const handleRestore = async (b: BackupFileMeta) => {
    await confirm({
      title: 'Restaurar copia',
      description: `Se reemplazarán TODOS los datos actuales por los de esta copia (${formatWhen(
        b.createdAt,
      )}). Antes se crea automáticamente una copia previa por si necesitas deshacer.`,
      confirmText: 'Restaurar',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          const res = await restoreExisting.mutateAsync(b.id);
          addNotification({
            type: 'info',
            title: 'Restauración en curso',
            message: 'Procesando datos…',
          });
          onRestoreStarted(res.id);
        } catch (e) {
          addNotification({ type: 'error', title: 'No se pudo restaurar', message: (e as Error).message });
          throw e;
        }
      },
    });
  };

  const handleDelete = async (b: BackupFileMeta) => {
    await confirm({
      title: 'Eliminar copia',
      description: `Se borrará el archivo de copia del ${formatWhen(b.createdAt)}. Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await deleteMut.mutateAsync(b.id);
          addNotification({ type: 'success', title: 'Copia eliminada', message: 'El archivo se ha borrado.' });
        } catch (e) {
          addNotification({ type: 'error', title: 'No se pudo eliminar', message: (e as Error).message });
          throw e;
        }
      },
    });
  };

  return (
    <section className="overflow-hidden rounded-[28px] border border-[var(--outline-variant)] bg-[var(--surface-container-low)]">
      {error ? (
        <div className="p-8 text-center text-sm text-[var(--error)]">
          Error al cargar las copias: {error.message}
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center gap-2 p-8 text-sm text-[var(--on-surface-variant)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
        </div>
      ) : backups.length === 0 ? (
        <div className="p-12 text-center">
          <p className="text-sm text-[var(--on-surface-variant)]">
            Todavía no hay copias de seguridad. Crea la primera con el botón de arriba.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--outline-variant)]">
          {backups.map((b) => {
            const canDownload = b.status === 'COMPLETED' && !!b.filename;
            return (
              <li key={b.id} className="flex items-center gap-3 px-4 py-3 sm:px-6">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--on-surface)]">
                    {formatWhen(b.createdAt)}
                    {b.type === 'AUTO_PRE_RESTORE' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--primary)]">
                        <ShieldCheck className="h-3 w-3" /> Auto pre-restore
                      </span>
                    )}
                    {b.scope === 'GLOBAL' && (
                      <span className="rounded-full bg-[var(--tertiary)]/20 px-2 py-0.5 text-[10px] font-medium text-[var(--on-tertiary-container)]">
                        Global
                      </span>
                    )}
                    {b.status === 'FAILED' && (
                      <span className="rounded-full bg-[var(--error)]/15 px-2 py-0.5 text-[10px] font-medium text-[var(--error)]">
                        Falló
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-[var(--on-surface-variant)]">
                    {b.rowCount != null ? `${b.rowCount} filas · ` : ''}
                    {formatBytes(b.fileSizeBytes)}
                    {b.notes ? ` · ${b.notes}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  <button
                    onClick={() => handleDownload(b)}
                    disabled={!canDownload}
                    className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-300 dark:hover:bg-zinc-800"
                  >
                    <Download className="h-3.5 w-3.5" /> Descargar
                  </button>
                  <button
                    onClick={() => handleRestore(b)}
                    disabled={!canDownload}
                    className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                  </button>
                  <button
                    onClick={() => handleDelete(b)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Eliminar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
