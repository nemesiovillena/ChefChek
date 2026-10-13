'use client';

import { useRef, useState } from 'react';
import { FileUp, Link2, Loader2, Sparkles, Type } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useCreateRecipeCapture, useUploadRecipeCapture } from '@/hooks/use-recipe-captures';
import {
  CAPTURE_FILE_TYPES,
  MAX_CAPTURE_FILE_BYTES,
  MAX_CAPTURE_TEXT_LENGTH,
  MIN_CAPTURE_TEXT_LENGTH,
} from '@/lib/recipe-capture-types';

const MODES = [
  { id: 'url', label: 'Enlace', icon: Link2 },
  { id: 'text', label: 'Pegar texto', icon: Type },
  { id: 'file', label: 'Foto o PDF', icon: FileUp },
] as const;
type Mode = (typeof MODES)[number]['id'];

// text-base (16 px): por debajo de eso iOS hace zoom al enfocar el campo.
const FIELD =
  'w-full rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-base text-[var(--on-surface)]';

/** Motivo por el que un archivo no se puede enviar, o null si es válido. */
function fileProblem(file: File): string | null {
  if (/\.hei[cf]$/i.test(file.name) || /hei[cf]/i.test(file.type)) {
    return 'Las fotos HEIC no se pueden leer. Usa JPG o PNG (en iPhone: Ajustes → Cámara → Formatos → Más compatible).';
  }
  if (!CAPTURE_FILE_TYPES.includes(file.type)) {
    return 'Formato no admitido. Usa una foto JPG o PNG, o un PDF.';
  }
  if (file.size > MAX_CAPTURE_FILE_BYTES) {
    return 'El archivo supera los 5 MB.';
  }
  return null;
}

/** Alta de una captura desde un enlace, un texto pegado o una foto/PDF. */
export function RecipeCaptureCreateForm() {
  const [mode, setMode] = useState<Mode>('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createMut = useCreateRecipeCapture();
  const uploadMut = useUploadRecipeCapture();
  const addNotification = useNotification();

  const isPending = createMut.isPending || uploadMut.isPending;
  const trimmedUrl = url.trim();
  const trimmedText = text.trim();
  const fileError = file ? fileProblem(file) : null;

  const canSubmit =
    !isPending &&
    ((mode === 'url' && /^https?:\/\/\S+\.\S+/i.test(trimmedUrl)) ||
      (mode === 'text' &&
        trimmedText.length >= MIN_CAPTURE_TEXT_LENGTH &&
        trimmedText.length <= MAX_CAPTURE_TEXT_LENGTH) ||
      (mode === 'file' && !!file && !fileError));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    try {
      if (mode === 'url') {
        await createMut.mutateAsync({ source: 'URL', url: trimmedUrl });
        setUrl('');
      } else if (mode === 'text') {
        await createMut.mutateAsync({ source: 'TEXTO', text: trimmedText });
        setText('');
      } else if (file) {
        await uploadMut.mutateAsync(file);
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
      addNotification({
        type: 'success',
        title: 'Captura en proceso',
        message: 'La IA está leyendo la receta. Aparecerá abajo lista para revisar en unos segundos.',
      });
    } catch (e) {
      addNotification({
        type: 'error',
        title: 'No se pudo capturar la receta',
        message: e instanceof Error ? e.message : 'Error desconocido',
      });
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4"
    >
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--on-surface)]">
        <Sparkles className="h-4 w-4" />
        Capturar una receta
      </h2>

      <div role="tablist" aria-label="Origen de la receta" className="grid grid-cols-3 gap-2">
        {MODES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mode === id}
            onClick={() => setMode(id)}
            className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
              mode === id
                ? 'border-[var(--primary)] bg-[var(--primary)] text-primary-foreground'
                : 'border-[var(--outline-variant)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>

      {mode === 'url' && (
        <div className="space-y-1">
          <label htmlFor="capture-url" className="text-xs font-medium text-[var(--on-surface-variant)]">
            Dirección de la página de la receta
          </label>
          <input
            id="capture-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            maxLength={2048}
            className={FIELD}
          />
          <p className="text-xs text-[var(--on-surface-variant)]">
            Funciona con páginas web de recetas. Redes sociales, vídeos y webs de pago no se pueden leer: en ese caso
            pega el texto.
          </p>
        </div>
      )}

      {mode === 'text' && (
        <div className="space-y-1">
          <label htmlFor="capture-text" className="text-xs font-medium text-[var(--on-surface-variant)]">
            Texto de la receta (ingredientes y elaboración)
          </label>
          <textarea
            id="capture-text"
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX_CAPTURE_TEXT_LENGTH}
            className={FIELD}
          />
          <p className="text-right text-xs text-[var(--on-surface-variant)]">
            {text.length.toLocaleString('es-ES')} / {MAX_CAPTURE_TEXT_LENGTH.toLocaleString('es-ES')}
          </p>
        </div>
      )}

      {mode === 'file' && (
        <div className="space-y-1">
          <label htmlFor="capture-file" className="text-xs font-medium text-[var(--on-surface-variant)]">
            Foto (JPG o PNG) o PDF de la receta, hasta 5 MB
          </label>
          <input
            id="capture-file"
            ref={fileInputRef}
            type="file"
            accept={CAPTURE_FILE_TYPES.join(',')}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className={`${FIELD} border-dashed`}
          />
          {fileError && <p className="text-xs text-[var(--error)]">{fileError}</p>}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {isPending ? 'Enviando...' : 'Capturar receta'}
      </button>
    </form>
  );
}
