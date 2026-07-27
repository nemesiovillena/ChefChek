'use client';

import { useRef, useState } from 'react';
import { Search, Upload, X, Loader2 } from 'lucide-react';
import { useNotification } from '@/components/notification-system';
import { useProductImageSearch } from '@/hooks/use-product-image-search';
import ProductThumbnail from './product-thumbnail';

interface ProductImagePickerProps {
  imageUrl: string;
  onChange: (url: string) => void;
  defaultQuery: string;
  onUploadFile: (file: File) => void;
  uploading?: boolean;
}

export default function ProductImagePicker({
  imageUrl,
  onChange,
  defaultQuery,
  onUploadFile,
  uploading = false,
}: ProductImagePickerProps) {
  const addNotification = useNotification();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [query, setQuery] = useState(defaultQuery);
  const { mutate: search, data: results, isPending: searching, error, reset } = useProductImageSearch();

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
    if (file.size > 2 * 1024 * 1024) {
      addNotification({ type: 'warning', title: 'Archivo demasiado grande', message: 'La imagen no puede superar los 2 MB.' });
      return;
    }
    onUploadFile(file);
    e.target.value = '';
  };

  return (
    <div className="flex items-start gap-3">
      <ProductThumbnail imageUrl={imageUrl} size={56} />

      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openPanel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            Buscar imagen
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
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
          <div className="mt-3 p-3 rounded-md border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/60">
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Término de búsqueda"
                className="flex-1 px-3 py-1.5 text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-white border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={searching || !query.trim()}
                className="px-3 py-1.5 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5"
              >
                {searching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Buscar
              </button>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="px-2 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                Cerrar
              </button>
            </div>

            {error && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error.message}</p>
            )}

            {results && results.length === 0 && !searching && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
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
                    className="aspect-square rounded-md overflow-hidden border border-gray-200 dark:border-zinc-700 hover:ring-2 hover:ring-indigo-500 transition-all bg-white dark:bg-zinc-800"
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
          </div>
        )}
      </div>
    </div>
  );
}
