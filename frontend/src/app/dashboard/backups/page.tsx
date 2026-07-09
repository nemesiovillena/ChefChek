'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DatabaseBackup, Plus, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useNotification } from '@/components/notification-system';
import {
  useBackups,
  useCreateBackup,
  backupBaseUrl,
} from '@/hooks/use-backups';
import { useInvalidateQueries } from '@/hooks/use-api';
import { BackupList } from './components/backup-list';
import { BackupRestoreFile } from './components/backup-restore-file';
import { BackupJobProgress } from './components/backup-job-progress';

const ADMIN_ROLES = ['ADMIN', 'OWNER', 'SUPERADMIN'];

export default function BackupsPage() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const router = useRouter();
  const addNotification = useNotification();
  const invalidate = useInvalidateQueries();

  const baseUrl = backupBaseUrl(user?.role === 'SUPERADMIN');
  const { data: backups, isLoading: listLoading, error } = useBackups(baseUrl);
  const createMut = useCreateBackup(baseUrl);

  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [restoreJobId, setRestoreJobId] = useState<string | null>(null);

  const canManage = ADMIN_ROLES.includes(user?.role ?? '');

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) router.push('/login');
    else if (!canManage) router.push('/dashboard');
  }, [isLoading, isAuthenticated, canManage, router]);

  if (!isAuthenticated || isLoading || !canManage) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-[var(--on-surface-variant)]">
        Cargando copias de seguridad...
      </div>
    );
  }

  const handleCreate = async () => {
    try {
      const res = await createMut.mutateAsync({ notes: 'Copia manual' });
      setExportJobId(res.id);
      addNotification({ type: 'info', title: 'Generando copia', message: 'Recopilando datos…' });
    } catch (e) {
      addNotification({ type: 'error', title: 'No se pudo crear', message: (e as Error).message });
    }
  };

  const handleExportTerminal = (status: 'COMPLETED' | 'FAILED') => {
    setExportJobId(null);
    invalidate([['backups', baseUrl]]);
    if (status === 'COMPLETED') {
      addNotification({ type: 'success', title: 'Copia creada', message: 'Ya disponible en el listado.' });
    } else {
      addNotification({ type: 'error', title: 'La copia falló', message: 'Revisa el registro para más detalle.' });
    }
  };

  const handleRestoreTerminal = (status: 'COMPLETED' | 'FAILED') => {
    setRestoreJobId(null);
    invalidate([['backups', baseUrl]]);
    if (status === 'COMPLETED') {
      addNotification({
        type: 'success',
        title: 'Restauración completada',
        message: 'Recarga las páginas para ver los datos restaurados.',
      });
    } else {
      addNotification({
        type: 'error',
        title: 'La restauración falló',
        message: 'Los datos no se modificaron (transacción revertida).',
      });
    }
  };

  const list = Array.isArray(backups) ? backups : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* <div> en vez de <header>: globals.css oculta todo header/nav sin .fixed */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-3xl tracking-tight text-[var(--on-surface)]">
            <DatabaseBackup className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
            Copias de Seguridad
          </h1>
          <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
            Exporta e importa los datos de {user?.role === 'SUPERADMIN' ? 'todo el ecosistema' : 'tu organización'}. Las restauraciones crean siempre una copia previa automática por seguridad.
          </p>
        </div>
        <button
          onClick={handleCreate}
          disabled={createMut.isPending || !!exportJobId}
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          {createMut.isPending || exportJobId ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Crear copia
        </button>
      </div>

      {exportJobId && (
        <div className="mb-4">
          <BackupJobProgress baseUrl={baseUrl} jobId={exportJobId} onTerminal={handleExportTerminal} />
        </div>
      )}

      {restoreJobId && (
        <div className="mb-4">
          <BackupJobProgress baseUrl={baseUrl} jobId={restoreJobId} onTerminal={handleRestoreTerminal} />
        </div>
      )}

      <div className="mb-6">
        <BackupRestoreFile baseUrl={baseUrl} onRestoreStarted={(id) => setRestoreJobId(id)} />
      </div>

      <BackupList
        baseUrl={baseUrl}
        backups={list}
        loading={listLoading}
        error={error}
        onRestoreStarted={(id) => setRestoreJobId(id)}
      />
    </div>
  );
}
