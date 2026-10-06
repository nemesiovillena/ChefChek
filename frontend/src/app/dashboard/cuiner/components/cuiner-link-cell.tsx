'use client';

import { useState } from 'react';
import { Check, Link2, Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { searchCuinerCatalog } from '@/hooks/use-cuiner';
import type { CuinerCatalogHit, CuinerCodeRef, CuinerSuggestion } from '@/lib/cuiner-types';

export const inputCls =
  'min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-3 text-base dark:border-zinc-700 dark:bg-zinc-900';

/**
 * Buscador del catálogo de Cuiner (proveedores o artículos) por nombre,
 * código o CIF. Llama a la API al pulsar Buscar o Enter, no en cada tecla.
 */
export function CuinerCatalogSearch({
  kind,
  initialQuery,
  onPick,
  onCancel,
}: {
  kind: 'supplier' | 'article';
  initialQuery: string;
  onPick: (hit: CuinerCatalogHit) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [hits, setHits] = useState<CuinerCatalogHit[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!query.trim()) return;
    setLoading(true);
    try {
      setHits(await searchCuinerCatalog(kind, query));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-900 dark:bg-indigo-950/30">
      <div className="flex gap-2">
        <input
          className={inputCls}
          value={query}
          autoFocus
          placeholder={kind === 'supplier' ? 'Nombre, código o CIF en Cuiner' : 'Descripción o código en Cuiner'}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') run();
            if (e.key === 'Escape') onCancel();
          }}
        />
        <Button type="button" onClick={run} disabled={loading} className="min-h-[44px]">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} className="min-h-[44px]" aria-label="Cancelar">
          <X className="h-4 w-4" />
        </Button>
      </div>
      {hits && hits.length === 0 && <p className="text-sm text-gray-500">Sin resultados en el catálogo de Cuiner.</p>}
      {hits && hits.length > 0 && (
        <ul className="max-h-60 divide-y divide-gray-200 overflow-y-auto rounded-md bg-white dark:divide-zinc-800 dark:bg-zinc-900">
          {hits.map((hit) => (
            <li key={hit.codigo}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-indigo-50 dark:hover:bg-zinc-800"
                onClick={() => onPick(hit)}
              >
                <span>
                  {hit.nombre}
                  {hit.detalle && <span className="ml-2 text-xs text-gray-500">{hit.detalle}</span>}
                </span>
                <span className="font-mono text-xs text-gray-500">{hit.codigo}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Celda de enlace de una fila: muestra el código de Cuiner enlazado o la
 * sugerencia (que el usuario acepta con un clic; nunca se guarda sola) y
 * permite cambiarlo con el buscador o quitar el enlace.
 */
export function CuinerLinkCell({
  kind,
  searchSeed,
  mapped,
  suggestion,
  busy,
  onLink,
  onUnlink,
}: {
  kind: 'supplier' | 'article';
  searchSeed: string;
  mapped: CuinerCodeRef | null;
  suggestion: CuinerSuggestion | null;
  busy: boolean;
  onLink: (codigo: string) => void;
  onUnlink: () => void;
}) {
  const [searching, setSearching] = useState(false);

  if (searching) {
    return (
      <CuinerCatalogSearch
        kind={kind}
        initialQuery={searchSeed}
        onCancel={() => setSearching(false)}
        onPick={(hit) => {
          setSearching(false);
          onLink(hit.codigo);
        }}
      />
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {mapped ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          <Link2 className="h-3.5 w-3.5" />
          {mapped.nombre}
          <span className="font-mono text-xs opacity-70">{mapped.codigo}</span>
        </span>
      ) : suggestion ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-amber-400 px-3 py-1 text-sm text-amber-800 dark:text-amber-300">
          ¿{suggestion.nombre}?
          <span className="font-mono text-xs opacity-70">{suggestion.codigo}</span>
          <span className="text-xs opacity-70">({suggestion.reason === 'cif' ? 'mismo CIF' : 'nombre parecido'})</span>
        </span>
      ) : (
        <span className="text-sm text-gray-500">Sin enlazar</span>
      )}

      {busy && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
      {!mapped && suggestion && (
        <Button type="button" size="sm" disabled={busy} onClick={() => onLink(suggestion.codigo)}>
          <Check className="h-3.5 w-3.5" /> Aceptar
        </Button>
      )}
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setSearching(true)}>
        <Search className="h-3.5 w-3.5" /> {mapped ? 'Cambiar' : 'Buscar'}
      </Button>
      {mapped && (
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onUnlink} aria-label="Quitar enlace">
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

export function Pager({
  page,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-2 pt-3 text-sm text-gray-600 dark:text-zinc-400">
      <span>
        {total} resultados · página {page} de {pages}
      </span>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Anterior
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Siguiente
        </Button>
      </div>
    </div>
  );
}
