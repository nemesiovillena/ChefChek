'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  /** 'card' (default): tarjeta propia, para usar sola (p.ej. sobre la tabla). 'attached': sin fondo/borde propio, para pegar debajo de otro bloque (p.ej. la tabla). */
  variant?: 'card' | 'attached';
  /** Texto cuando total === 0, p.ej. "Sin artículos" / "Sin recetas". */
  emptyLabel?: string;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function getPageNumbers(page: number, totalPages: number): (number | '…')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set([1, totalPages, page, page - 1, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const result: (number | '…')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - (sorted[i - 1] as number) > 1) result.push('…');
    result.push(p);
  });
  return result;
}

export default function PaginationControls({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  variant = 'attached',
  emptyLabel = 'Sin resultados',
}: PaginationControlsProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const wrapperClassName =
    variant === 'card'
      ? 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-3 bg-surface-raised border border-line-soft shadow rounded-lg'
      : 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-3 border-t border-line-soft';

  return (
    <div className={wrapperClassName}>
      <div className="flex items-center gap-2 text-sm text-text-soft">
        <span>{total === 0 ? emptyLabel : `${from}–${to} de ${total}`}</span>
        <label className="flex items-center gap-1.5 ml-2">
          <span>Por página</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-2 py-1 bg-surface-raised text-text-strong border border-line rounded-md focus:outline-none focus:ring-ring focus:border-ring"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="p-1.5 rounded-md text-text-muted hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {getPageNumbers(page, totalPages).map((p, i) =>
            p === '…' ? (
              <span key={`ellipsis-${i}`} className="px-2 text-sm text-gray-400 dark:text-gray-600">…</span>
            ) : (
              <button
                key={`page-${p}`}
                type="button"
                onClick={() => onPageChange(p)}
                className={`min-w-[2rem] px-2 py-1 text-sm rounded-md transition-colors ${
                  p === page
                    ? 'bg-primary text-primary-foreground'
                    : 'text-text-default hover:bg-surface-hover'
                }`}
              >
                {p}
              </button>
            )
          )}

          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="p-1.5 rounded-md text-text-muted hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Página siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
