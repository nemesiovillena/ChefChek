'use client';

import { useRef, useState } from 'react';
import { UploadCloud, Loader2, FileJson } from 'lucide-react';
import { restoreFromFile } from '@/hooks/use-backups';
import { useInvalidateQueries } from '@/hooks/use-api';
import { useConfirm } from '@/contexts/confirm.context';
import { useNotification } from '@/components/notification-system';

interface Props {
  baseUrl: string;
  /** Se invoca con el id del job de restore para que el padre muestre su progreso. */
  onRestoreStarted: (jobId: string) => void;
}

/**
 * Subida de un archivo .json de copia para restaurar. Muestra la barra de
 * subida real (axios onUploadProgress). La restauración destructiva va detrás
 * de un useConfirm() (nunca confirm() nativo) y siempre crea un auto-backup
 * previo en el backend.
 */
export function BackupRestoreFile({ baseUrl, onRestoreStarted }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const invalidate = useInvalidateQueries();
  const confirm = useConfirm();
  const addNotification = useNotification();

  const startRestore = async (file: File) => {
    await confirm({
      title: 'Restaurar desde archivo',
      description:
        'Se reemplazarán TODOS los datos actuales por los del archivo. Antes de tocar nada se crea automáticamente una copia de seguridad previa (visible en el historial) por si necesitas deshacer. Esta acción no se puede deshacer directamente.',
      confirmText: 'Restaurar',
      variant: 'destructive',
      onConfirm: async () => {
        setBusy(true);
        setUploadPct(0);
        try {
          const res = await restoreFromFile(
            baseUrl,
            file,
            setUploadPct,
            invalidate,
          );
          addNotification({
            type: 'info',
            title: 'Restauración en curso',
            message: 'Archivo recibido. Procesando datos…',
          });
          setUploadPct(null);
          onRestoreStarted(res.id);
        } catch (e) {
          addNotification({
            type: 'error',
            title: 'Error al restaurar',
            message: (e as Error).message,
          });
          throw e;
        } finally {
          setBusy(false);
        }
      },
    });
  };

  return (
    <div className="rounded-2xl border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4">
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void startRestore(f);
          e.target.value = '';
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <UploadCloud className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--on-surface)]">
            Restaurar desde archivo
          </p>
          <p className="text-xs text-[var(--on-surface-variant)]">
            Sube un <FileJson className="inline h-3 w-3" /> .json de copia previa
            para reemplazar los datos actuales.
          </p>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-300 dark:hover:bg-zinc-800"
        >
          <UploadCloud className="h-4 w-4" /> Elegir archivo
        </button>
      </div>

      {uploadPct !== null && (
        <div className="mt-3">
          <div className="mb-1.5 flex w-full items-center justify-between text-sm">
            <span className="font-medium text-[var(--on-surface)]">Subiendo archivo…</span>
            <span className="tabular-nums text-[var(--on-surface-variant)]">{uploadPct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-container-highest)]">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${uploadPct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
