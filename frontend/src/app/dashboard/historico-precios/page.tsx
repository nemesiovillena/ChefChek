'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAllPriceHistory } from '@/hooks/use-price-history';
import { PriceHistoryTable } from './components/price-history-table';

const PAGE_SIZE = 25;

export default function HistoricoPreciosPage() {
  const [page, setPage] = useState(1);
  const { data: result, isLoading, error } = useAllPriceHistory(page, PAGE_SIZE);

  return (
    <div className="px-margin-mobile md:px-margin-desktop max-w-container-max-width mx-auto pb-24 pt-8">
      <div className="mb-stack-xl">
        <span className="font-label-md text-label-md text-secondary tracking-widest uppercase">Almacén</span>
        <h2 className="font-headline-lg text-headline-lg text-primary mt-stack-xs">Histórico de Precios</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Cambios de precio de compra de todos los artículos, más recientes primero.
        </p>
      </div>

      <div className="tonal-layer-2 rounded-xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-secondary" />
          </div>
        ) : error ? (
          <p className="text-sm text-error p-6">Error al cargar el histórico de precios.</p>
        ) : !result || result.data.length === 0 ? (
          <p className="text-sm text-on-surface-variant p-6">Todavía no hay cambios de precio registrados.</p>
        ) : (
          <>
            <PriceHistoryTable entries={result.data} />
            <div className="flex items-center justify-between p-stack-md border-t border-border">
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                Página {result.page} de {result.totalPages} · {result.total} cambios
              </p>
              <div className="flex gap-stack-sm">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={!result.hasPrevious}
                  className="px-stack-md py-1.5 rounded-lg font-label-sm text-label-sm text-on-surface-variant border border-border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-variant transition-colors cursor-pointer"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!result.hasNext}
                  className="px-stack-md py-1.5 rounded-lg font-label-sm text-label-sm text-on-surface-variant border border-border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-variant transition-colors cursor-pointer"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
