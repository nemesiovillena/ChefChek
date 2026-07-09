'use client';

import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useBackupJob } from '@/hooks/use-backups';

interface Props {
  baseUrl: string;
  /** Id del job a vigiar; null/no muestra nada. */
  jobId: string | null;
  /** Se dispara una vez al alcanzar COMPLETED/FAILED. */
  onTerminal?: (status: 'COMPLETED' | 'FAILED', error: string | null) => void;
}

/**
 * Tarjeta de progreso de un job de backup/restore. Hace polling del estado en
 * vivo (useBackupJob) y avisa al terminar. Reutilizable para export y restore.
 *
 * Barra inline con tokens M3 (no usa el <Progress> de base-ui, cuyo tipado de
 * `children` como función render es incompatible con uso simple).
 */
export function BackupJobProgress({ baseUrl, jobId, onTerminal }: Props) {
  const { data } = useBackupJob(baseUrl, jobId);
  const firedRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      jobId &&
      data &&
      (data.status === 'COMPLETED' || data.status === 'FAILED') &&
      firedRef.current !== jobId
    ) {
      firedRef.current = jobId;
      onTerminal?.(data.status, data.error);
    }
  }, [jobId, data, onTerminal]);

  if (!jobId || !data) return null;

  const label =
    data.status === 'COMPLETED'
      ? 'Completado'
      : data.status === 'FAILED'
        ? 'Falló'
        : data.step || 'Procesando...';
  const running = data.status === 'RUNNING' || data.status === 'PENDING';

  return (
    <div className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
      <div className="mb-1.5 flex w-full items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2 font-medium text-[var(--on-surface)]">
          {running && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {label}
        </span>
        <span className="tabular-nums text-[var(--on-surface-variant)]">{data.progress}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-container-highest)]">
        <div
          className="h-full rounded-full bg-indigo-600 transition-all duration-300"
          style={{ width: `${data.progress}%` }}
        />
      </div>
      {data.status === 'FAILED' && data.error && (
        <p className="mt-2 line-clamp-3 text-xs text-[var(--error)]">{data.error}</p>
      )}
    </div>
  );
}
