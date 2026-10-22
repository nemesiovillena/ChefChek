'use client';

import { useRef, useState } from 'react';
import { FileText, Loader2, Sparkles, X } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useExtractAgreement } from '@/hooks/use-check-in';
import type { AgreementExtraction } from '@/lib/check-in-types';
import { cardCls, errorMessage, labelCls, secondaryBtnCls } from './check-in-form-styles';

const MAX_FILES = 3;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';

/**
 * Sube el convenio (y sus revisiones) para que la IA proponga los parámetros.
 * Los archivos no se guardan: solo se leen para rellenar el formulario.
 */
export function CheckInAgreementExtractCard({
  onProposal,
}: {
  onProposal: (extraction: AgreementExtraction) => void;
}) {
  const notify = useNotification();
  const extract = useExtractAgreement();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files, ...Array.from(list)].slice(0, MAX_FILES);
    setFiles(next);
    // Permite volver a elegir el mismo archivo tras quitarlo.
    if (inputRef.current) inputRef.current.value = '';
  }

  async function handleRead() {
    const total = files.reduce((sum, f) => sum + f.size, 0);
    if (total > MAX_TOTAL_BYTES) {
      notify({ type: 'error', title: 'Archivos demasiado grandes', message: 'Máximo 20 MB en total.' });
      return;
    }
    try {
      const result = await extract.mutateAsync(files);
      onProposal(result);
      setFiles([]);
      const count = Object.keys(result.fields).length;
      notify({
        type: 'success',
        title: 'Convenio leído',
        message: `${count} de 10 parámetros encontrados. Revísalos y pulsa Guardar.`,
      });
    } catch (err) {
      notify({ type: 'error', title: 'No se pudo leer el convenio', message: errorMessage(err) });
    }
  }

  return (
    <div className={`${cardCls} space-y-3`}>
      <div>
        <h3 className="font-semibold">Leer el convenio con IA</h3>
        <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
          Sube el PDF de tu convenio (y, si las hay, sus revisiones). La IA propone los parámetros con el artículo de
          donde salen. No se guarda nada hasta que pulses «Guardar parámetros», y el archivo no se conserva.
        </p>
      </div>

      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((file, i) => (
            <li key={`${file.name}-${i}`} className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-[var(--on-surface-variant)]" />
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                disabled={extract.isPending}
                aria-label={`Quitar ${file.name}`}
                className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[var(--surface-container-high)]"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <label className={`${secondaryBtnCls} cursor-pointer ${files.length >= MAX_FILES || extract.isPending ? 'pointer-events-none opacity-40' : ''}`}>
          <FileText className="h-4 w-4" />
          {files.length ? 'Añadir otro archivo' : 'Elegir archivo'}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="sr-only"
            onChange={(e) => addFiles(e.target.files)}
          />
        </label>
        <button
          type="button"
          onClick={handleRead}
          disabled={!files.length || extract.isPending}
          className={`${secondaryBtnCls} border-[var(--primary)] text-[var(--primary)]`}
        >
          {extract.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {extract.isPending ? 'Leyendo… puede tardar un minuto' : 'Leer convenio'}
        </button>
      </div>
      <p className={labelCls}>PDF o fotos, hasta {MAX_FILES} archivos y 20 MB en total.</p>
    </div>
  );
}
