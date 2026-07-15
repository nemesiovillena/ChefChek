'use client';

import { useRef, useState } from 'react';
import { FileUp, Loader2, Sparkles, Settings } from 'lucide-react';
import Link from 'next/link';
import { useSuppliers } from '@/hooks/use-suppliers';
import { useCreateCatalogImport } from '@/hooks/use-catalog-imports';
import { useNotification } from '@/components/notification-system';
import { getApiKeyForModel } from '@/lib/ai-api-keys';

/** Catálogos requieren siempre IA: no hay modo "solo OCR" como en albaranes. */
const AI_MODELS = [
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'gpt-4o', name: 'GPT-4o' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku' },
];

const STORAGE_KEY_MODEL = 'catalog_ai_model';

export function CatalogImportUploader({ onCreated }: { onCreated: (id: string) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: suppliers } = useSuppliers({ isActive: true });
  const createMut = useCreateCatalogImport();
  const addNotification = useNotification();

  const [supplierId, setSupplierId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [aiModel, setAiModel] = useState<string>(() => {
    if (typeof window === 'undefined') return AI_MODELS[0].id;
    return localStorage.getItem(STORAGE_KEY_MODEL) || AI_MODELS[0].id;
  });

  const handleModelChange = (model: string) => {
    setAiModel(model);
    localStorage.setItem(STORAGE_KEY_MODEL, model);
  };

  const aiApiKey = getApiKeyForModel(aiModel);

  const handleUpload = async () => {
    if (!supplierId || !file) return;
    if (!aiApiKey) {
      addNotification({
        type: 'error',
        title: 'Falta la API key',
        message: 'Configura la API key del modelo elegido en Ajustes.',
      });
      return;
    }
    try {
      const created = await createMut.mutateAsync({ supplierId, file, aiModel, aiApiKey });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      addNotification({
        type: 'success',
        title: 'Catálogo procesado',
        message: `${created.lines.length} línea(s) extraída(s) para revisar`,
      });
      onCreated(created.id);
    } catch (e) {
      addNotification({
        type: 'error',
        title: 'No se pudo procesar el catálogo',
        message: e instanceof Error ? e.message : 'Error desconocido',
      });
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--on-surface)]">
        <FileUp className="h-4 w-4" />
        Subir tarifa o catálogo de proveedor
      </h2>

      <select
        value={supplierId}
        onChange={(e) => setSupplierId(e.target.value)}
        className="w-full rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm text-[var(--on-surface)]"
      >
        <option value="">Proveedor...</option>
        {(suppliers ?? []).map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-[var(--on-surface-variant)]">
          <Sparkles className="h-3.5 w-3.5" />
          Motor de extracción (requiere API key propia)
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {AI_MODELS.map((model) => (
            <button
              key={model.id}
              type="button"
              onClick={() => handleModelChange(model.id)}
              className={`rounded-lg border p-2 text-left text-xs font-medium transition ${
                aiModel === model.id
                  ? 'border-[var(--primary)] bg-[var(--primary)] text-primary-foreground'
                  : 'border-[var(--outline-variant)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]'
              }`}
            >
              {model.name}
            </button>
          ))}
        </div>
        {!aiApiKey && (
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-1 text-xs text-[var(--error)] hover:underline"
          >
            <Settings className="h-3 w-3" />
            Configura la API key en Ajustes
          </Link>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="w-full rounded-xl border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm text-[var(--on-surface)]"
      />

      <button
        onClick={handleUpload}
        disabled={!supplierId || !file || !aiApiKey || createMut.isPending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {createMut.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileUp className="h-4 w-4" />
        )}
        {createMut.isPending ? 'Procesando con IA...' : 'Subir y extraer'}
      </button>
    </div>
  );
}
