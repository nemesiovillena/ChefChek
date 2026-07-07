'use client';

import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from '@/components/ui/progress';
import { useBackupJob } from '@/hooks/use-backups';
// NOTA: el <Progress> de base-ui tipa `children` como función render, así que la
// etiqueta y el porcentaje se renderizan FUERA del componente, no como hijos.

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
      <div className="mb-1 flex w-full items-center justify-between gap-2">
        <ProgressLabel className="flex items-center gap-2 text-[var(--on-surface)]">
          {running && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {label}
        </ProgressLabel>
        <ProgressValue>{data.progress}%</ProgressValue>
      </div>
      <Progress value={data.progress} />
      {data.status === 'FAILED' && data.error && (
        <p className="mt-2 line-clamp-3 text-xs text-[var(--error)]">{data.error}</p>
      )}
    </div>
  );
}
