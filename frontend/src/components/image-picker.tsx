'use client';

import { useRef, useState } from 'react';
import { Search, Upload, X, Loader2 } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useImageSearch } from '@/hooks/use-image-search';
import ImageThumbnail from './image-thumbnail';

interface ImagePickerProps {
  imageUrl: string;
  onChange: (url: string) => void;
  defaultQuery: string;
  onUploadFile: (file: File) => void;
  uploading?: boolean;
  /** Límite de tamaño del archivo subido, en MB. La feature puede validar más a fondo en onUploadFile. */
  maxSizeMB?: number;
}

/**
 * Selector de imagen compartido: buscar en stock (Pexels), subir archivo local
 * o quitar. Guarda la URL elegida (hotlink de Pexels o ruta /uploads propia).
 */
export default function ImagePicker({
  imageUrl,
  onChange,
  defaultQuery,
  onUploadFile,
  uploading = false,
  maxSizeMB = 2,
}: ImagePickerProps) {
  const addNotification = useNotification();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [query, setQuery] = useState(defaultQuery);
  const { mutate: search, data: results, isPending: searching, error, reset } = useImageSearch();

  const openPanel = () => {
    setQuery(defaultQuery);
    setPanelOpen(true);
    reset();
  };

  const handleSearch = () => {
    if (!query.trim()) return;
    search(query.trim());
  };

  const handlePick = (url: string) => {
    onChange(url);
    setPanelOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > maxSizeMB * 1024 * 1024) {
      addNotification({ type: 'warning', title: 'Archivo demasiado grande', message: `La imagen no puede superar los ${maxSizeMB} MB.` });
      return;
    }
    onUploadFile(file);
    e.target.value = '';
  };

  return (
    <div className="flex items-start gap-3">
      <ImageThumbnail imageUrl={imageUrl} size={56} />

      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openPanel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-line text-text-default hover:bg-surface-hover-faint transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            Buscar imagen
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-line text-text-default hover:bg-surface-hover-faint disabled:opacity-50 transition-colors"
          >
            <Upload className="h-3.5 w-3.5" />
            {uploading ? 'Subiendo...' : 'Subir archivo'}
          </button>
          {imageUrl && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Quitar
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>

        {panelOpen && (
          <div className="mt-3 p-3 rounded-md border border-line-soft bg-surface-sunken">
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Término de búsqueda"
                className="flex-1 px-3 py-1.5 text-sm bg-surface-raised text-text-strong border border-line rounded-md focus:outline-none focus:ring-ring focus:border-ring"
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={searching || !query.trim()}
                className="px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5"
              >
                {searching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Buscar
              </button>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="px-2 py-1.5 text-sm text-text-muted hover:text-text-default dark:hover:text-gray-200"
              >
                Cerrar
              </button>
            </div>

            {error && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error.message}</p>
            )}

            {results && results.length === 0 && !searching && (
              <p className="mt-2 text-xs text-text-muted">
                Sin resultados. Prueba otra búsqueda o sube un archivo.
              </p>
            )}

            {results && results.length > 0 && (
              <div className="mt-3 grid grid-cols-4 sm:grid-cols-8 gap-2">
                {results.map((r, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handlePick(r.url)}
                    title={r.title}
                    className="aspect-square rounded-md overflow-hidden border border-line-soft hover:ring-2 hover:ring-ring transition-all bg-surface-raised"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.thumbnailUrl || r.url}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }}
                    />
                  </button>
                ))}
              </div>
            )}

            {results && results.length > 0 && (
              <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
                Fotos proporcionadas por{' '}
                <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-text-soft dark:hover:text-gray-300">
                  Pexels
                </a>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
